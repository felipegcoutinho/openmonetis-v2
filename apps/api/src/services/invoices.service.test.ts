import assert from "node:assert/strict";
import test from "node:test";
import type { ApiError } from "../utils/errors";
import { createInvoicesService, type InvoicesRepository } from "./invoices.service";

const userId = "10000000-0000-4000-8000-000000000001";
const cardId = "20000000-0000-4000-8000-000000000002";
const accountId = "30000000-0000-4000-8000-000000000003";
const adminPersonId = "40000000-0000-4000-8000-000000000004";
const externalPersonId = "50000000-0000-4000-8000-000000000005";
const paymentId = "60000000-0000-4000-8000-000000000006";

type PaymentDraft = Parameters<InvoicesRepository["insertPayment"]>[0];

function createRepository(onInsert: (data: PaymentDraft) => void): InvoicesRepository {
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
