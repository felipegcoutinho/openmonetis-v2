import {
  type AuthenticatedUser,
  assertPersonStatusAllowed,
  calculatePersonFinancialSummary,
  createAdminPersonDraft,
  createExternalPersonDraft,
  PersonStatusRuleError,
} from "@openmonetis/domain/people";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import type {
  CreatePersonInput,
  PersonFinancialSummaryOutput,
  PersonOutput,
  ReplacePersonInput,
  UpdatePersonInput,
} from "@openmonetis/validators/people";
import type {
  ListTransactionsQuery,
  PaginatedTransactionsOutput,
} from "@openmonetis/validators/transactions";
import { badRequest, notFound } from "../utils/errors";

export type PersonRecord = {
  id: string;
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  providerAvatarUrl: string | null;
  role: "admin" | "external";
  status: "active" | "inactive";
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};
type PersonCreateRecord = Omit<PersonRecord, "id" | "createdAt" | "updatedAt">;
type PersonUpdateRecord = Partial<
  Pick<PersonRecord, "name" | "email" | "avatarUrl" | "status" | "note">
>;
export type PeopleRepository = {
  findAdminByUserId(userId: string): Promise<PersonRecord | null>;
  insert(data: PersonCreateRecord): Promise<PersonRecord>;
  listByUser(userId: string): Promise<PersonRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<PersonRecord | null>;
  updateForUser(id: string, userId: string, data: PersonUpdateRecord): Promise<PersonRecord | null>;
  updateAdminProviderAvatar(userId: string, avatarUrl: string): Promise<boolean>;
  deleteExternalForUser(id: string, userId: string): Promise<PersonRecord | null>;
};

type PeopleTransactionsReader = {
  list(userId: string, query: ListTransactionsQuery): Promise<PaginatedTransactionsOutput>;
};

function toOutput(person: PersonRecord): PersonOutput {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    avatarUrl: person.avatarUrl,
    providerAvatarUrl: person.providerAvatarUrl,
    role: person.role,
    status: person.status,
    note: person.note,
    createdAt: person.createdAt.toISOString(),
    updatedAt: person.updatedAt.toISOString(),
  };
}

export function createPeopleService(
  repository: PeopleRepository,
  transactionsReader?: PeopleTransactionsReader,
) {
  return {
    async ensureAdmin(user: AuthenticatedUser) {
      const currentAdmin = await repository.findAdminByUserId(user.id);
      return (
        currentAdmin ?? repository.insert(createAdminPersonDraft(user, { avatarUrl: user.image }))
      );
    },
    async syncAdminProviderAvatar(userId: string, avatarUrl: string) {
      return repository.updateAdminProviderAvatar(userId, avatarUrl.trim());
    },
    async create(input: CreatePersonInput, userId: string) {
      return toOutput(
        await repository.insert(
          createExternalPersonDraft({
            userId,
            name: input.name,
            email: input.email ?? null,
            avatarUrl: input.avatarUrl ?? null,
            note: input.note ?? null,
            status: input.status,
          }),
        ),
      );
    },
    async list(userId: string) {
      return (await repository.listByUser(userId)).map(toOutput);
    },
    async getAdmin(userId: string) {
      const person = await repository.findAdminByUserId(userId);
      if (!person) throw notFound("Admin person not found", "admin_person_not_found");
      return toOutput(person);
    },
    async get(id: string, userId: string) {
      const person = await repository.findByIdForUser(id, userId);
      if (!person) throw notFound("Person not found", "person_not_found");
      return toOutput(person);
    },
    async getFinancialSummary(
      id: string,
      userId: string,
      period: string,
    ): Promise<PersonFinancialSummaryOutput> {
      const person = await repository.findByIdForUser(id, userId);
      if (!person) throw notFound("Person not found", "person_not_found");
      if (!transactionsReader) throw new Error("People transactions reader is not configured");

      const periods = Array.from({ length: 6 }, (_, index) => addMonthsToPeriod(period, index - 5));
      const entries = (
        await Promise.all(
          periods.map((entryPeriod) =>
            listAllPersonTransactions(transactionsReader, userId, id, entryPeriod),
          ),
        )
      ).flat();

      return calculatePersonFinancialSummary(entries, periods, period);
    },
    async replace(id: string, userId: string, input: ReplacePersonInput) {
      const currentPerson = await repository.findByIdForUser(id, userId);
      if (!currentPerson) throw notFound("Person not found", "person_not_found");
      assertAllowedPersonStatus(currentPerson.role, input.status);
      if (currentPerson.role === "admin" && !input.email?.trim()) {
        throw badRequest("Admin email is required", "admin_email_required");
      }
      const person = await repository.updateForUser(id, userId, {
        name: input.name.trim(),
        email: input.email?.trim() || null,
        avatarUrl: input.avatarUrl?.trim() || null,
        note: input.note?.trim() || null,
        status: input.status,
      });
      if (!person) throw notFound("Person not found", "person_not_found");
      return toOutput(person);
    },
    async update(id: string, userId: string, input: UpdatePersonInput) {
      const currentPerson = await repository.findByIdForUser(id, userId);
      if (!currentPerson) throw notFound("Person not found", "person_not_found");
      if (input.status !== undefined) assertAllowedPersonStatus(currentPerson.role, input.status);
      if (currentPerson.role === "admin" && input.email !== undefined && !input.email?.trim()) {
        throw badRequest("Admin email is required", "admin_email_required");
      }
      const values: PersonUpdateRecord = {};
      if (input.name !== undefined) values.name = input.name.trim();
      if (input.email !== undefined) values.email = input.email?.trim() || null;
      if (input.avatarUrl !== undefined) values.avatarUrl = input.avatarUrl?.trim() || null;
      if (input.note !== undefined) values.note = input.note?.trim() || null;
      if (input.status !== undefined) values.status = input.status;
      const person = await repository.updateForUser(id, userId, values);
      if (!person) throw notFound("Person not found", "person_not_found");
      return toOutput(person);
    },
    async remove(id: string, userId: string) {
      const person = await repository.deleteExternalForUser(id, userId);
      if (!person) throw notFound("Person not found", "person_not_found");
      return { id: person.id };
    },
  };
}
export type PeopleService = ReturnType<typeof createPeopleService>;

function assertAllowedPersonStatus(role: PersonRecord["role"], status: PersonRecord["status"]) {
  try {
    assertPersonStatusAllowed(role, status);
  } catch (error) {
    if (error instanceof PersonStatusRuleError) throw badRequest(error.message, error.code);
    throw error;
  }
}

async function listAllPersonTransactions(
  reader: PeopleTransactionsReader,
  userId: string,
  personId: string,
  period: string,
) {
  const query = {
    period,
    personIds: [personId],
    categoryIds: [],
    accountIds: [],
    cardIds: [],
    hasAttachments: false,
    isDivided: false,
    page: 1,
    pageSize: 100,
  } satisfies ListTransactionsQuery;
  const firstPage = await reader.list(userId, query);
  const pageCount = Math.ceil(firstPage.total / firstPage.pageSize);
  const remainingPages = await Promise.all(
    Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) =>
      reader.list(userId, { ...query, page: index + 2 }),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) =>
    page.items.flatMap((item) =>
      item.paymentMethod === null
        ? []
        : [
            {
              amount: item.allocation?.amount ?? item.amount,
              paymentMethod: item.paymentMethod,
              period: item.period,
              type: item.type,
            },
          ],
    ),
  );
}
