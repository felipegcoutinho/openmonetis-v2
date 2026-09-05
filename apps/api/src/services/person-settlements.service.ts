import {
  calculatePersonBalance,
  type PersonBalanceEntry,
} from "@openmonetis/domain/person-settlements";
import {
  projectRecurringMonthAllocations,
  type RecurringAllocationRule,
} from "@openmonetis/domain/recurring-expenses";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  CreatePersonSettlementInput,
  PersonBalanceOutput,
  PersonSettlementOutput,
  PersonSettlementSnapshotOutput,
  PersonSettlementsSummaryOutput,
} from "@openmonetis/validators/person-settlements";
import { badRequest, notFound } from "../utils/errors";

export type PersonSettlementRecord = {
  id: string;
  userId: string;
  personId: string;
  invoicePaymentAllocationId: string | null;
  amount: string;
  receivedAt: Date;
  note: string | null;
  createdAt: Date;
};

export type PersonBalanceEntryRecord = {
  kind: "expense" | "refund";
  amount: string;
};

export type PersonRecord = {
  id: string;
  name: string;
  role: "admin" | "external";
  status: "active" | "inactive";
};

export type PersonSettlementSummaryPersonRecord = PersonRecord & {
  avatarUrl: string | null;
};

export type PersonSettlementsRepository = {
  findPersonForUser(personId: string, userId: string): Promise<PersonRecord | null>;
  listExternalPeopleForUser(userId: string): Promise<PersonSettlementSummaryPersonRecord[]>;
  listSettlementsForPerson(
    personId: string,
    userId: string,
    period: string,
  ): Promise<PersonSettlementRecord[]>;
  listBalanceEntriesForPerson(
    personId: string,
    userId: string,
    period: string,
  ): Promise<PersonBalanceEntryRecord[]>;
  listRecurringBalanceRulesForPeriod(
    userId: string,
    period: string,
  ): Promise<RecurringAllocationRule[]>;
  createSettlement(input: {
    userId: string;
    personId: string;
    amount: string;
    receivedAt: Date;
    note: string | null;
  }): Promise<PersonSettlementRecord | null>;
  deleteSettlementForUser(id: string, userId: string): Promise<PersonSettlementRecord | null>;
};

function toOutput(record: PersonSettlementRecord): PersonSettlementOutput {
  return {
    id: record.id,
    personId: record.personId,
    amount: Number(record.amount),
    receivedAt: record.receivedAt.toISOString().slice(0, 10),
    note: record.note,
    source: record.invoicePaymentAllocationId ? "invoicePayment" : "manual",
    createdAt: record.createdAt.toISOString(),
  };
}

function toBalanceOutput(
  entries: PersonBalanceEntryRecord[],
  settlements: PersonSettlementRecord[],
): PersonBalanceOutput {
  const balance = calculatePersonBalance([
    ...entries.map(
      (entry): PersonBalanceEntry => ({
        kind: entry.kind,
        amount: Number(entry.amount),
      }),
    ),
    ...settlements.map(
      (settlement): PersonBalanceEntry => ({
        kind: "settlement",
        amount: Number(settlement.amount),
      }),
    ),
  ]);
  return balance;
}

function parseDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw badRequest("Data inválida", "INVALID_SETTLEMENT_DATE");
  }
  return date;
}

export function createPersonSettlementsService(repository: PersonSettlementsRepository) {
  return {
    async getSummary(userId: string, period: string): Promise<PersonSettlementsSummaryOutput> {
      const [people, recurringRules] = await Promise.all([
        repository.listExternalPeopleForUser(userId),
        repository.listRecurringBalanceRulesForPeriod(userId, period),
      ]);
      const recurringAllocations = projectRecurringMonthAllocations({
        period,
        rules: recurringRules,
      });
      const items = await Promise.all(
        people.map(async (person) => {
          const [entries, settlements] = await Promise.all([
            repository.listBalanceEntriesForPerson(person.id, userId, period),
            repository.listSettlementsForPerson(person.id, userId, period),
          ]);
          const recurringEntries = recurringAllocations.flatMap((allocation) =>
            allocation.personId === person.id
              ? [{ kind: "expense" as const, amount: String(allocation.amount) }]
              : [],
          );

          return {
            personId: person.id,
            personName: person.name,
            personAvatarUrl: person.avatarUrl,
            personStatus: person.status,
            balance: toBalanceOutput([...entries, ...recurringEntries], settlements),
          };
        }),
      );
      const outstandingItems = items
        .filter((item) => item.balance.status !== "settled")
        .sort(
          (left, right) =>
            Math.abs(right.balance.balanceAmount) - Math.abs(left.balance.balanceAmount) ||
            left.personName.localeCompare(right.personName, "pt-BR"),
        );

      return {
        period,
        totalReceivableAmount: sumCurrency(
          outstandingItems.map((item) => item.balance.receivableAmount),
        ),
        totalCreditAmount: sumCurrency(outstandingItems.map((item) => item.balance.creditAmount)),
        items: outstandingItems,
      };
    },

    async getSnapshot(
      personId: string,
      userId: string,
      period: string,
    ): Promise<PersonSettlementSnapshotOutput> {
      const person = await repository.findPersonForUser(personId, userId);
      if (!person) throw notFound("Person not found", "PERSON_NOT_FOUND");
      const [entries, recurringRules, settlements] = await Promise.all([
        repository.listBalanceEntriesForPerson(personId, userId, period),
        repository.listRecurringBalanceRulesForPeriod(userId, period),
        repository.listSettlementsForPerson(personId, userId, period),
      ]);
      const recurringEntries = projectRecurringMonthAllocations({
        period,
        rules: recurringRules,
      }).flatMap((allocation) =>
        allocation.personId === personId
          ? [{ kind: "expense" as const, amount: String(allocation.amount) }]
          : [],
      );
      return {
        personId,
        period,
        balance: toBalanceOutput([...entries, ...recurringEntries], settlements),
        settlements: settlements.map(toOutput),
      };
    },

    async create(
      input: CreatePersonSettlementInput,
      userId: string,
    ): Promise<PersonSettlementOutput> {
      const person = await repository.findPersonForUser(input.personId, userId);
      if (!person) throw notFound("Person not found", "PERSON_NOT_FOUND");
      if (person.role !== "external") {
        throw badRequest(
          "Only external people can receive settlements",
          "PERSON_SETTLEMENT_ADMIN_NOT_ALLOWED",
        );
      }
      if (person.status !== "active") {
        throw badRequest("Inactive people cannot receive settlements", "PERSON_INACTIVE");
      }

      const receivedAt = parseDate(input.receivedAt);
      if (input.receivedAt > getCurrentDateInBrazil()) {
        throw badRequest("A data não pode estar no futuro", "SETTLEMENT_DATE_IN_FUTURE");
      }

      const record = await repository.createSettlement({
        userId,
        personId: person.id,
        amount: input.amount.toFixed(2),
        receivedAt,
        note: input.note?.trim() || null,
      });
      if (!record) throw notFound("Person not found", "PERSON_NOT_FOUND");
      return toOutput(record);
    },

    async remove(id: string, userId: string) {
      const deleted = await repository.deleteSettlementForUser(id, userId);
      if (!deleted) throw notFound("Settlement not found", "PERSON_SETTLEMENT_NOT_FOUND");
      return { id: deleted.id };
    },
  };
}

function sumCurrency(amounts: number[]) {
  return amounts.reduce((total, amount) => total + Math.round(amount * 100), 0) / 100;
}

export type PersonSettlementsService = ReturnType<typeof createPersonSettlementsService>;
