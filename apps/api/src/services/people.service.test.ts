import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePersonFinancialSummary,
  defaultAdminPersonAvatarUrl,
} from "@openmonetis/domain/people";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import type { PeopleRepository, PersonRecord } from "./people.service";
import { createPeopleService } from "./people.service";

const adminPerson: PersonRecord = {
  id: "admin-person",
  userId: "user-1",
  name: "Admin",
  email: "admin@example.com",
  avatarUrl: "/avatars/default_icon.png",
  providerAvatarUrl: null,
  role: "admin",
  status: "active",
  note: null,
  createdAt: new Date("2026-08-23T12:00:00.000Z"),
  updatedAt: new Date("2026-08-23T12:00:00.000Z"),
};

function createRepository(onUpdate: () => void): PeopleRepository {
  return {
    findAdminByUserId: async () => adminPerson,
    insert: async () => adminPerson,
    listByUser: async () => [adminPerson],
    findByIdForUser: async () => adminPerson,
    updateForUser: async () => {
      onUpdate();
      return adminPerson;
    },
    updateAdminProviderAvatar: async () => true,
    deleteExternalForUser: async () => null,
  };
}

test("uses the Google profile image when provisioning the admin person", async () => {
  const googleAvatarUrl = "https://lh3.googleusercontent.com/avatar";
  const repository = createRepository(() => undefined);
  repository.findAdminByUserId = async () => null;
  repository.insert = async (data) => ({ ...adminPerson, ...data });
  const service = createPeopleService(repository);

  const person = await service.ensureAdmin({
    id: "google-user",
    name: "Google User",
    email: "google@example.com",
    image: googleAvatarUrl,
    providerAvatarUrl: googleAvatarUrl,
  });

  assert.equal(person.avatarUrl, googleAvatarUrl);
  assert.equal(person.providerAvatarUrl, googleAvatarUrl);
});

test("uses the default avatar when provisioning an admin person without an image", async () => {
  const repository = createRepository(() => undefined);
  repository.findAdminByUserId = async () => null;
  repository.insert = async (data) => ({ ...adminPerson, ...data });
  const service = createPeopleService(repository);

  const person = await service.ensureAdmin({
    id: "email-user",
    name: "Email User",
    email: "email@example.com",
    image: null,
    providerAvatarUrl: null,
  });

  assert.equal(person.avatarUrl, defaultAdminPersonAvatarUrl);
  assert.equal(person.providerAvatarUrl, null);
});

test("does not replace the admin person with an inactive status", async () => {
  let updated = false;
  const service = createPeopleService(createRepository(() => (updated = true)));

  await assert.rejects(
    service.replace(adminPerson.id, adminPerson.userId, {
      name: adminPerson.name,
      email: adminPerson.email,
      avatarUrl: adminPerson.avatarUrl,
      note: adminPerson.note,
      status: "inactive",
    }),
    (error) =>
      error instanceof Error && "code" in error && error.code === "admin_person_must_be_active",
  );
  assert.equal(updated, false);
});

test("does not update the admin person to an inactive status", async () => {
  let updated = false;
  const service = createPeopleService(createRepository(() => (updated = true)));

  await assert.rejects(
    service.update(adminPerson.id, adminPerson.userId, { status: "inactive" }),
    (error) =>
      error instanceof Error && "code" in error && error.code === "admin_person_must_be_active",
  );
  assert.equal(updated, false);
});

test("financial summary uses the person's allocation instead of the full transaction", async () => {
  const service = createPeopleService(
    createRepository(() => undefined),
    {
      async list(_userId, query) {
        const items =
          query.period === "2026-08"
            ? [
                {
                  type: "expense",
                  paymentMethod: "boleto",
                  period: "2026-08",
                  amount: -100,
                  allocation: {
                    personId: adminPerson.id,
                    personName: adminPerson.name,
                    personAvatarUrl: null,
                    amount: -40,
                  },
                } as TransactionOutput,
              ]
            : [];
        return { items, total: items.length, page: 1, pageSize: 100 };
      },
    },
  );

  const summary = await service.getFinancialSummary(adminPerson.id, adminPerson.userId, "2026-08");

  assert.equal(summary.totalExpenses, 40);
  assert.equal(summary.paymentMethods.find((item) => item.paymentMethod === "boleto")?.amount, 40);
});

test("financial summary includes every payment method even when it has no expenses", () => {
  const summary = calculatePersonFinancialSummary(
    [
      {
        amount: -75,
        origin: "regular",
        paymentMethod: "boleto",
        period: "2026-08",
        type: "expense",
      },
    ],
    ["2026-08"],
    "2026-08",
  );

  assert.deepEqual(
    summary.paymentMethods.map((item) => item.paymentMethod),
    ["credit_card", "debit_card", "pix", "cash", "boleto", "benefits", "bank_transfer"],
  );
  assert.equal(summary.paymentMethods.find((item) => item.paymentMethod === "pix")?.amount, 0);
});

test("invoice reduction lowers the selected person's expenses", () => {
  const summary = calculatePersonFinancialSummary(
    [
      {
        amount: -100,
        origin: "regular",
        paymentMethod: "credit_card",
        period: "2026-08",
        type: "expense",
      },
      {
        amount: 25,
        origin: "invoiceAdjustment",
        paymentMethod: "credit_card",
        period: "2026-08",
        type: "expense",
      },
    ],
    ["2026-08"],
    "2026-08",
  );

  assert.equal(summary.totalExpenses, 75);
  assert.equal(summary.paymentMethods[0]?.amount, 75);
});
