import assert from "node:assert/strict";
import test from "node:test";
import { ListTransactionsQuerySchema } from "@openmonetis/validators/transactions";
import type { TransactionWithRelations } from "../repositories/transactions.repository";
import {
  createTransactionsService,
  type TransactionsServiceDependencies,
} from "./transactions.service";

const userId = "10000000-0000-4000-8000-000000000001";
const transactionId = "20000000-0000-4000-8000-000000000002";
const firstPersonId = "30000000-0000-4000-8000-000000000003";
const secondPersonId = "40000000-0000-4000-8000-000000000004";

function transactionFixture(
  overrides: Partial<TransactionWithRelations> = {},
): TransactionWithRelations {
  return {
    id: transactionId,
    userId,
    personId: firstPersonId,
    type: "expense",
    origin: "regular",
    condition: "single",
    paymentMethod: "boleto",
    name: "Conta de energia",
    amount: "-100.00",
    purchaseDate: new Date("2026-08-23T00:00:00.000Z"),
    period: "2026-09",
    accountId: "50000000-0000-4000-8000-000000000005",
    cardId: null,
    categoryId: "60000000-0000-4000-8000-000000000006",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-09-04T00:00:00.000Z"),
    boletoPaymentDate: null,
    installmentCount: null,
    currentInstallment: null,
    seriesId: null,
    transferId: null,
    recurringRuleId: null,
    isSettled: false,
    note: null,
    importSourceFingerprint: null,
    importExternalId: null,
    importBatchId: null,
    createdAt: new Date("2026-08-23T12:00:00.000Z"),
    updatedAt: new Date("2026-08-23T12:00:00.000Z"),
    personName: "Pessoa 1",
    personAvatarUrl: null,
    accountName: "Conta principal",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    invoicePaymentCardName: null,
    invoicePaymentCardLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    refundSourceId: null,
    refundedAmount: "0",
    anticipationId: null,
    installmentOriginalPeriod: null,
    ...overrides,
  };
}

test("divided transactions become allocation rows linked to the same editable record", async () => {
  const transaction = transactionFixture();
  let listedTransactions = [transaction];
  const dependencies = new Proxy(
    {
      listTransactionsByPeriod: async () => listedTransactions,
      listRecurringRulesForPeriod: async () => [],
      listTransactionSplitsForUser: async () => [
        {
          transactionId,
          personId: firstPersonId,
          personName: "Pessoa 1",
          personAvatarUrl: null,
          amount: "-50.00",
        },
        {
          transactionId,
          personId: secondPersonId,
          personName: "Pessoa 2",
          personAvatarUrl: null,
          amount: "-50.00",
        },
      ],
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [],
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });

  const result = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09" }),
  );

  assert.equal(result.total, 1);
  assert.deepEqual(
    result.items.map((item) => [
      item.id,
      item.recordId,
      item.allocation?.personId,
      item.allocation?.amount,
      item.displayAmount,
    ]),
    [
      [`${transactionId}:${firstPersonId}`, transactionId, firstPersonId, -50, 100],
      [`${transactionId}:${secondPersonId}`, transactionId, secondPersonId, -50, 100],
    ],
  );
  assert.deepEqual(
    result.items[0]?.splitShares.map((share) => [share.personId, share.amount]),
    [
      [firstPersonId, 50],
      [secondPersonId, 50],
    ],
  );

  const filtered = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({
      period: "2026-09",
      personIds: secondPersonId,
      minAmount: 40,
      maxAmount: 60,
    }),
  );

  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0]?.allocation?.personId, secondPersonId);
  assert.equal(filtered.items[0]?.allocation?.amount, -50);

  // Five purchases fit on a page, even when one has two allocation rows.
  listedTransactions = [
    transaction,
    ...Array.from({ length: 5 }, (_, index) =>
      transactionFixture({
        id: `${index + 7}0000000-0000-4000-8000-000000000001`,
        purchaseDate: new Date("2026-08-22T00:00:00.000Z"),
        name: `Compra ${index}`,
        amount: `-${(index + 2) * 100}.00`,
      }),
    ),
  ];
  const paged = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", pageSize: 5 }),
  );
  assert.equal(paged.total, 6);
  assert.equal(paged.items.length, 6);
  assert.equal(paged.items.filter((item) => item.recordId === transactionId).length, 2);
  const nextPage = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", pageSize: 5, page: 2 }),
  );
  assert.equal(nextPage.items.length, 1);
  assert.equal(
    nextPage.items.some((item) => item.recordId === transactionId),
    false,
  );
  const byAmount = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", sort: "amount" }),
  );
  assert.equal(byAmount.items[0]?.amount, -600);
  const searched = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", q: "única" }),
  );
  assert.equal(searched.total, 6);
  listedTransactions = [
    transactionFixture({
      paymentMethod: "credit_card",
      isSettled: null,
      cardId: "70000000-0000-4000-8000-000000000007",
    }),
    transactionFixture({ id: "80000000-0000-4000-8000-000000000008", isSettled: true }),
  ];
  const invoiceOnly = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", settlement: "invoice" }),
  );
  assert.equal(invoiceOnly.total, 1);
  assert.ok(invoiceOnly.items.every((item) => item.isSettled === null));
});

test("installment series reallocates divided shares proportionally for each target amount", async () => {
  const seriesId = "70000000-0000-4000-8000-000000000007";
  const secondTransactionId = "80000000-0000-4000-8000-000000000008";
  const thirdTransactionId = "90000000-0000-4000-8000-000000000009";
  const anchor = transactionFixture({
    amount: "-10.01",
    condition: "installment",
    installmentCount: 3,
    currentInstallment: 1,
    seriesId,
  });
  let receivedUpdates: Parameters<
    TransactionsServiceDependencies["updateTransactionSeriesRangeWithSplitsForUser"]
  >[1] = [];
  const dependencies = new Proxy(
    {
      findTransactionByIdForUser: async () => anchor,
      listTransactionSplitsForUser: async () => [
        {
          transactionId,
          personId: firstPersonId,
          personName: "Pessoa 1",
          personAvatarUrl: null,
          amount: "-5.01",
        },
        {
          transactionId,
          personId: secondPersonId,
          personName: "Pessoa 2",
          personAvatarUrl: null,
          amount: "-5.00",
        },
      ],
      findPersonByIdForUser: async (id: string) => ({ id, name: "Pessoa", status: "active" }),
      findCategoryByIdForUser: async () => ({
        id: anchor.categoryId,
        name: "Moradia",
        type: "expense",
      }),
      findAccountByIdForUser: async () => ({ id: anchor.accountId, isArchived: false }),
      listTransactionSeriesForUser: async () => [
        {
          id: transactionId,
          amount: "-10.01",
          purchaseDate: anchor.purchaseDate,
          period: "2026-09",
          dueDate: anchor.dueDate,
          boletoPaymentDate: null,
          currentInstallment: 1,
          isSettled: false,
        },
        {
          id: secondTransactionId,
          amount: "-10.00",
          purchaseDate: anchor.purchaseDate,
          period: "2026-10",
          dueDate: new Date("2026-10-04T00:00:00.000Z"),
          boletoPaymentDate: null,
          currentInstallment: 2,
          isSettled: false,
        },
        {
          id: thirdTransactionId,
          amount: "-10.00",
          purchaseDate: anchor.purchaseDate,
          period: "2026-11",
          dueDate: new Date("2026-11-04T00:00:00.000Z"),
          boletoPaymentDate: null,
          currentInstallment: 3,
          isSettled: false,
        },
      ],
      updateTransactionSeriesRangeWithSplitsForUser: async (
        _userId: string,
        updates: typeof receivedUpdates,
      ) => {
        receivedUpdates = updates;
        return updates.map((update) => update.id);
      },
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });

  await service.updateTransaction(
    transactionId,
    userId,
    {
      splitShares: [
        { personId: firstPersonId, amount: 6.68 },
        { personId: secondPersonId, amount: 3.33 },
      ],
    },
    "series",
  );

  assert.deepEqual(
    receivedUpdates.map((update) => update.splits),
    [
      [
        { personId: firstPersonId, amount: "-6.68" },
        { personId: secondPersonId, amount: "-3.33" },
      ],
      [
        { personId: firstPersonId, amount: "-6.67" },
        { personId: secondPersonId, amount: "-3.33" },
      ],
      [
        { personId: firstPersonId, amount: "-6.67" },
        { personId: secondPersonId, amount: "-3.33" },
      ],
    ],
  );
});

test("invoice adjustments can only be removed through the invoice workflow", async () => {
  const dependencies = new Proxy(
    {
      findTransactionByIdForUser: async () =>
        transactionFixture({
          origin: "invoiceAdjustment",
          paymentMethod: "credit_card",
          cardId: "70000000-0000-4000-8000-000000000007",
        }),
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });

  await assert.rejects(
    service.deleteTransaction(transactionId, userId),
    (error: { code?: string }) => error.code === "GENERATED_TRANSACTION_IMMUTABLE",
  );
});

test("settlement preserves the chosen boleto payment date and rejects future dates without writes", async () => {
  const paymentDates: Date[] = [];
  const fixture = transactionFixture();
  const dependencies = new Proxy(
    {
      findTransactionByIdForUser: async () => fixture,
      settleTransactionsForUser: async (
        _ids: string[],
        _userId: string,
        _settled: boolean,
        _period: string,
        _snapshots: unknown,
        date: Date,
      ) => {
        paymentDates.push(date);
        return [fixture];
      },
      findRecurringRuleByIdForUser: async () => ({
        startDate: new Date("2020-01-04T00:00:00.000Z"),
        endDate: null,
        frequency: "monthly",
        paymentMethod: "boleto",
      }),
      settleRecurringOccurrenceForUser: async (
        _id: string,
        _purchaseDate: Date,
        _userId: string,
        _settled: boolean,
        date: Date,
      ) => {
        paymentDates.push(date);
        return fixture;
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  await service.settleTransactions([transactionId], userId, true, "2020-02-01");
  await service.settleRecurringOccurrence(transactionId, "2020-01-04", userId, true, "2020-02-02");
  assert.deepEqual(
    paymentDates.map((date) => date.toISOString()),
    ["2020-02-01T00:00:00.000Z", "2020-02-02T00:00:00.000Z"],
  );
  await assert.rejects(service.settleTransactions([transactionId], userId, true, "9999-01-01"), {
    code: "SETTLEMENT_DATE_FUTURE",
  });
  await assert.rejects(
    service.settleRecurringOccurrence(transactionId, "2020-01-04", userId, true, "9999-01-01"),
    { code: "SETTLEMENT_DATE_FUTURE" },
  );
  assert.equal(paymentDates.length, 2);
});
