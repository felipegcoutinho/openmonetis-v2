import assert from "node:assert/strict";
import test from "node:test";
import {
  createDefaultCategoryDrafts,
  invoiceAdjustmentCategoryName,
} from "@openmonetis/domain/categories";
import type { ApiError } from "../utils/errors";
import { createInvoicesService, type InvoicesRepository } from "./invoices.service";

const userId = "10000000-0000-4000-8000-000000000001";
const cardId = "20000000-0000-4000-8000-000000000002";
const accountId = "30000000-0000-4000-8000-000000000003";
const adminPersonId = "40000000-0000-4000-8000-000000000004";
const externalPersonId = "50000000-0000-4000-8000-000000000005";
const paymentId = "60000000-0000-4000-8000-000000000006";

type PaymentDraft = Parameters<InvoicesRepository["insertPayment"]>[0];

test("default categories use one expense category for every invoice adjustment", () => {
  const categories = createDefaultCategoryDrafts(userId).filter(
    (category) => category.name === invoiceAdjustmentCategoryName,
  );

  assert.deepEqual(
    categories.map((category) => ({ type: category.type, isSystem: category.isSystem })),
    [{ type: "expense", isSystem: true }],
  );
});

function createRepository(
  onInsert: (data: PaymentDraft) => void,
  overrides: Partial<InvoicesRepository> = {},
): InvoicesRepository {
  return new Proxy(
    {
      listCards: async () => [
        {
          id: cardId,
          accountId,
          name: "Nubank",
          logo: null,
          closingDay: 5,
          closingRuleType: "fixedDay" as const,
          closingOffsetDays: null,
          closingOffsetMode: null,
          closingDayPurchasesNextInvoice: false,
          dueDay: 10,
        },
      ],
      listAccounts: async () => [{ id: accountId, name: "Conta principal", logo: null }],
      listMovements: async () => [
        {
          cardId,
          personId: adminPersonId,
          personName: "Pessoa principal",
          personAvatarUrl: null,
          personRole: "admin" as const,
          amount: "-1000.00",
        },
        {
          cardId,
          personId: externalPersonId,
          personName: "Pessoa externa",
          personAvatarUrl: null,
          personRole: "external" as const,
          amount: "-9999.99",
        },
      ],
      listRecurringMovements: async () => [],
      listPaymentAllocations: async () => [],
      listPayments: async () => [],
      listDates: async () => [],
      findOwnedContext: async (
        _userId: string,
        _cardId: string,
        requestedAccountId: string | null,
        personIds: string[],
      ) => ({
        card: { id: cardId, name: "Nubank" },
        account:
          requestedAccountId === accountId ? { id: accountId, name: "Conta principal" } : null,
        people: [
          { id: adminPersonId, name: "Pessoa principal" },
          { id: externalPersonId, name: "Pessoa externa" },
        ].filter((person) => personIds.includes(person.id)),
        adminPersonId,
        paymentCategoryId: "70000000-0000-4000-8000-000000000007",
      }),
      insertPayment: async (data: PaymentDraft) => {
        onInsert(data);
        return { id: paymentId };
      },
      ...overrides,
      ...({} as Pick<InvoicesRepository, never>),
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected repository call: ${String(property)}`);
        };
      },
    },
  ) as unknown as InvoicesRepository;
}

test("full invoice payment moves only the primary person's allocation", async () => {
  let inserted: PaymentDraft | undefined;
  const service = createInvoicesService(
    createRepository((data) => {
      inserted = data;
    }),
    () => "2026-09-04",
  );

  const result = await service.pay(
    cardId,
    "2026-09",
    {
      accountId,
      paidAt: "2026-09-04",
      allocations: [
        { personId: adminPersonId, amount: 1000 },
        { personId: externalPersonId, amount: 9999.99 },
      ],
    },
    userId,
  );

  assert.equal(inserted?.amount, 10999.99);
  assert.equal(inserted?.adminAmount, 1000);
  assert.equal(inserted?.accountId, accountId);
  assert.deepEqual(result, {
    id: paymentId,
    amount: 10999.99,
    accountAmount: 1000,
    remainingAmount: 0,
    status: "paid",
  });
});

test("external person's payment does not require or move an account", async () => {
  let inserted: PaymentDraft | undefined;
  const service = createInvoicesService(
    createRepository((data) => {
      inserted = data;
    }),
    () => "2026-09-04",
  );

  const result = await service.pay(
    cardId,
    "2026-09",
    {
      accountId: null,
      paidAt: "2026-09-04",
      allocations: [{ personId: externalPersonId, amount: 9999.99 }],
    },
    userId,
  );

  assert.equal(inserted?.adminAmount, 0);
  assert.equal(inserted?.accountId, null);
  assert.equal(result.accountAmount, 0);
  assert.equal(result.remainingAmount, 1000);
  assert.notEqual(result.status, "paid");
});

test("primary person's payment requires a financial account", async () => {
  const service = createInvoicesService(
    createRepository(() => undefined),
    () => "2026-09-04",
  );

  await assert.rejects(
    service.pay(
      cardId,
      "2026-09",
      {
        accountId: null,
        paidAt: "2026-09-04",
        allocations: [{ personId: adminPersonId, amount: 500 }],
      },
      userId,
    ),
    (error: ApiError) => error.code === "invoice_payment_account_required" && error.status === 400,
  );
});

test("invoice reduction is an expense adjustment assigned entirely to the selected person", async () => {
  let inserted: Parameters<InvoicesRepository["insertAdjustment"]>[0] | undefined;
  const adjustmentId = "80000000-0000-4000-8000-000000000008";
  const categoryId = "70000000-0000-4000-8000-000000000007";
  const service = createInvoicesService(
    createRepository(() => undefined, {
      findAdjustmentContext: async (_userId, _cardId, personId) => ({
        card: { id: cardId, name: "Nubank" },
        personId,
        categoryId,
      }),
      insertAdjustment: async (data) => {
        inserted = data;
        return { id: adjustmentId };
      },
    }),
    () => "2026-09-04",
  );

  const result = await service.adjust(
    cardId,
    "2026-09",
    { amount: 10989.99, date: "2026-09-04", personId: externalPersonId },
    userId,
  );

  assert.equal(inserted?.personId, externalPersonId);
  assert.equal(inserted?.categoryId, categoryId);
  assert.equal(inserted?.amount, "10.00");
  assert.equal(inserted?.type, "expense");
  assert.equal(result.id, adjustmentId);
});

test("paid invoice must be reopened before it can be adjusted", async () => {
  const service = createInvoicesService(
    createRepository(() => undefined, {
      listPayments: async () => [{ id: paymentId, cardId, amount: "100.00", paidAt: "2026-09-03" }],
    }),
    () => "2026-09-04",
  );

  await assert.rejects(
    service.adjust(
      cardId,
      "2026-09",
      { amount: 11009.99, date: "2026-09-04", personId: externalPersonId },
      userId,
    ),
    (error: ApiError) => error.code === "invoice_requires_reopen" && error.status === 409,
  );
});

test("invoice reduction cannot exceed the selected person's amount", async () => {
  const service = createInvoicesService(
    createRepository(() => undefined, {
      findAdjustmentContext: async () => ({
        card: { id: cardId, name: "Nubank" },
        personId: adminPersonId,
        categoryId: "70000000-0000-4000-8000-000000000007",
      }),
    }),
    () => "2026-09-04",
  );

  await assert.rejects(
    service.adjust(
      cardId,
      "2026-09",
      { amount: 8999.99, date: "2026-09-04", personId: adminPersonId },
      userId,
    ),
    (error: ApiError) =>
      error.code === "invoice_adjustment_exceeds_person_amount" && error.status === 400,
  );
});

test("reopening an invoice delegates reversal of every payment", async () => {
  const service = createInvoicesService(
    createRepository(() => undefined, {
      reopenInvoice: async () => ({ reversedPaymentCount: 2, reversedAmount: 750 }),
    }),
  );

  assert.deepEqual(await service.reopen(cardId, "2026-09", userId), {
    reversedPaymentCount: 2,
    reversedAmount: 750,
  });
});
