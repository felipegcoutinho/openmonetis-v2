import assert from "node:assert/strict";
import test from "node:test";
import {
  ListTransactionsQuerySchema,
  type TransactionInput,
  TransactionInputSchema,
  UpdateRecurringRuleQuerySchema,
} from "@openmonetis/validators/transactions";
import type {
  RecurringRuleWithRelations,
  TransactionWithRelations,
} from "../repositories/transactions.repository";
import {
  createTransactionsService,
  type TransactionsServiceDependencies,
} from "./transactions.service";

const userId = "10000000-0000-4000-8000-000000000001";
const transactionId = "20000000-0000-4000-8000-000000000002";
const firstPersonId = "30000000-0000-4000-8000-000000000003";
const secondPersonId = "40000000-0000-4000-8000-000000000004";
const recurringRuleId = "70000000-0000-4000-8000-000000000007";

test("closing-day purchases shift new singles and installments while existing and explicit periods stay fixed", async () => {
  const cardId = "80000000-0000-4000-8000-000000000008";
  let recorded = transactionFixture({
    paymentMethod: "credit_card",
    accountId: null,
    cardId,
    dueDate: null,
    purchaseDate: new Date("2026-10-05"),
    period: "2026-10",
    isSettled: null,
  });
  let installmentPeriods: string[] = [];
  const overrides = {
    listPaidInvoicePeriodsForUser: async () => [],
    getCardExpenseTotalForUser: async () => 0,
    findPersonByIdForUser: async () => ({ id: firstPersonId, name: "Pessoa", status: "active" }),
    findCategoryByIdForUser: async () => ({
      id: recorded.categoryId,
      name: "Moradia",
      type: "expense",
    }),
    findCardByIdForUser: async () => ({
      id: cardId,
      name: "Principal",
      status: "active",
      closingDay: 5,
      closingRuleType: "fixedDay",
      closingOffsetDays: null,
      closingOffsetMode: null,
      closingDayPurchasesNextInvoice: true,
      dueDay: 10,
      limit: "1000.00",
    }),
    findTransactionByIdForUser: async () => recorded,
    listTransactionSplitsForUser: async () => [],
    listTransactionIdsWithAttachmentsForUser: async () => [],
    updateTransactionWithSplitsForUser: async (
      _id: string,
      _ownerId: string,
      data: Parameters<TransactionsServiceDependencies["updateTransactionWithSplitsForUser"]>[2],
    ) => {
      recorded = { ...recorded, ...data };
      return recorded;
    },
    insertTransactionsWithSplits: async (
      records: Parameters<TransactionsServiceDependencies["insertTransactionsWithSplits"]>[0],
    ) => records.map((record) => ({ ...recorded, ...record })),
    insertInstallmentSeriesWithTransactions: async (
      _series: Parameters<
        TransactionsServiceDependencies["insertInstallmentSeriesWithTransactions"]
      >[0],
      records: Parameters<
        TransactionsServiceDependencies["insertInstallmentSeriesWithTransactions"]
      >[1],
    ) => {
      installmentPeriods = records.map((record) => record.period);
      return records.map((record) => ({ ...recorded, ...record }));
    },
  };
  const dependencies = new Proxy(overrides, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return async () => {
        throw new Error(`Unexpected dependency call: ${String(property)}`);
      };
    },
  }) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  const edited = await service.updateTransaction(transactionId, userId, {
    name: "Compra renomeada",
  });
  assert.equal(edited.period, "2026-10");
  const input = TransactionInputSchema.parse({
    type: "expense",
    paymentMethod: "credit_card",
    name: "Compra nova",
    amount: 300,
    purchaseDate: "2026-10-05",
    personId: firstPersonId,
    cardId,
    categoryId: recorded.categoryId,
  });
  assert.equal((await service.createTransaction({ ...input, userId })).period, "2026-11");
  assert.equal(
    (await service.createTransaction({ ...input, userId, invoicePeriod: "2026-10" })).period,
    "2026-10",
  );
  await service.createTransaction({
    ...input,
    userId,
    condition: "installment",
    installmentCount: 3,
  });
  assert.deepEqual(installmentPeriods, ["2026-11", "2026-12", "2027-01"]);
});

test("recurring edit query keeps legacy whole-series updates and requires a scoped date", () => {
  assert.deepEqual(UpdateRecurringRuleQuerySchema.parse({}), { scope: "series" });
  assert.equal(UpdateRecurringRuleQuerySchema.safeParse({ scope: "single" }).success, false);
  assert.equal(
    UpdateRecurringRuleQuerySchema.safeParse({
      scope: "future",
      occurrenceDate: "2026-10-01",
    }).success,
    true,
  );
});

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

test("account statement lists a paid boleto in its payment month while transactions keep the due month", async () => {
  const accountId = "50000000-0000-4000-8000-000000000005";
  const paidBoleto = transactionFixture({
    purchaseDate: new Date("2026-07-20T00:00:00.000Z"),
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    boletoPaymentDate: new Date("2026-08-28T00:00:00.000Z"),
    isSettled: true,
  });
  const dependencies = new Proxy(
    {
      listAccountStatementTransactionsForUser: async (_userId: string, period: string) =>
        period === "2026-08" ? [paidBoleto] : [],
      listTransactionsByPeriod: async (_userId: string, period: string) =>
        period === "2026-09" ? [paidBoleto] : [],
      listRecurringRulesForPeriod: async () => [],
      listSettledRecurringBoletoOccurrencesByPaymentDateForUser: async () => [],
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [],
      listTransactionSplitsForUser: async () => [],
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
  const statementQuery = (period: string) =>
    ListTransactionsQuerySchema.parse({ view: "accountStatement", period, accountIds: accountId });

  const augustStatement = await service.listTransactions(userId, statementQuery("2026-08"));
  const septemberStatement = await service.listTransactions(userId, statementQuery("2026-09"));
  const augustTransactions = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-08" }),
  );
  const septemberTransactions = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09" }),
  );

  assert.equal(augustStatement.total, 1);
  assert.equal(augustStatement.items[0]?.postingDate, "2026-08-28");
  assert.equal(augustStatement.items[0]?.period, "2026-09");
  assert.equal(septemberStatement.total, 0);
  assert.equal(augustTransactions.total, 0);
  assert.equal(septemberTransactions.total, 1);
  assert.equal(
    ListTransactionsQuerySchema.safeParse({ view: "accountStatement", period: "2026-08" }).success,
    false,
  );
});

test("account statement includes an early recurring boleto payment before the rule starts", async () => {
  const rule: RecurringRuleWithRelations = {
    id: recurringRuleId,
    userId,
    seriesId: "80000000-0000-4000-8000-000000000008",
    personId: firstPersonId,
    type: "expense",
    paymentMethod: "boleto",
    name: "Conta de energia",
    amount: "-100.00",
    anchorDate: new Date("2026-09-01T00:00:00.000Z"),
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    frequency: "monthly",
    accountId: "50000000-0000-4000-8000-000000000005",
    cardId: null,
    categoryId: "60000000-0000-4000-8000-000000000006",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    isSettled: false,
    note: null,
    status: "active",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    personName: "Pessoa 1",
    personAvatarUrl: null,
    accountName: "Conta principal",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardClosingDayPurchasesNextInvoice: null,
    cardDueDay: null,
  };
  const occurrence = {
    recurringRuleId,
    recurringSeriesId: rule.seriesId,
    purchaseDate: new Date("2026-09-01T00:00:00.000Z"),
    isSettled: true,
    accountId: null,
    boletoPaymentDate: new Date("2026-08-28T00:00:00.000Z"),
  };
  const dependencies = new Proxy(
    {
      listAccountStatementTransactionsForUser: async () => [],
      listTransactionsByPeriod: async () => [],
      listRecurringRulesForPeriod: async (_userId: string, end: Date) =>
        end.toISOString().startsWith("2026-09") ? [rule] : [],
      listRecurringRulesByIdsForUser: async () => [rule],
      listSettledRecurringBoletoOccurrencesByPaymentDateForUser: async (
        _userId: string,
        _accountId: string,
        start: Date,
      ) => (start.toISOString().startsWith("2026-08") ? [occurrence] : []),
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [occurrence],
      listTransactionSplitsForUser: async () => [],
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
  const statementQuery = (period: string) =>
    ListTransactionsQuerySchema.parse({
      view: "accountStatement",
      period,
      accountIds: rule.accountId,
    });

  const augustStatement = await service.listTransactions(userId, statementQuery("2026-08"));
  const septemberStatement = await service.listTransactions(userId, statementQuery("2026-09"));
  const septemberTransactions = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09" }),
  );

  assert.equal(augustStatement.total, 1);
  assert.equal(augustStatement.items[0]?.postingDate, "2026-08-28");
  assert.equal(augustStatement.items[0]?.period, "2026-09");
  assert.equal(septemberStatement.total, 0);
  assert.equal(septemberTransactions.total, 1);
  assert.equal(septemberTransactions.items[0]?.isSettled, true);
  assert.equal(septemberTransactions.items[0]?.boletoPaymentDate, "2026-08-28");
});

test("editing a recurring boleto preserves the rule settlement state", async () => {
  const rule: RecurringRuleWithRelations = {
    id: recurringRuleId,
    userId,
    seriesId: "80000000-0000-4000-8000-000000000008",
    personId: firstPersonId,
    type: "expense",
    paymentMethod: "boleto",
    name: "Conta de energia",
    amount: "-100.00",
    anchorDate: new Date("2026-09-01T00:00:00.000Z"),
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    frequency: "monthly",
    accountId: "50000000-0000-4000-8000-000000000005",
    cardId: null,
    categoryId: "60000000-0000-4000-8000-000000000006",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    isSettled: false,
    note: null,
    status: "active",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    personName: "Pessoa 1",
    personAvatarUrl: null,
    accountName: "Conta principal",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardClosingDayPurchasesNextInvoice: null,
    cardDueDay: null,
  };
  let savedSettlement: boolean | null | undefined;
  const versions = [{ id: rule.id, startDate: rule.startDate, updatedAt: rule.updatedAt }];
  const writes: Array<{
    values: { isSettled?: boolean | null; anchorDate?: Date; startDate?: Date; frequency?: string };
    splits: Array<{ personId: string; amount: string }>;
  }> = [];
  const scopes: Array<{
    scope: "single" | "future" | "series";
    hasPrevious: boolean;
    previousDate: Date;
    nextDate: Date | null;
  }> = [];
  const dependencies = new Proxy(
    {
      findRecurringRuleByIdForUser: async () => rule,
      listRecurringRulesBySeriesForUser: async () => versions,
      findPersonByIdForUser: async () => ({ id: firstPersonId, status: "active" }),
      findCategoryByIdForUser: async () => ({
        id: rule.categoryId,
        type: "expense",
        name: "Moradia",
      }),
      findAccountByIdForUser: async () => ({ id: rule.accountId, isArchived: false }),
      updateRecurringRuleWithSplitsForUser: async (
        _id: string,
        _userId: string,
        values: (typeof writes)[number]["values"],
        splits: (typeof writes)[number]["splits"],
        options: (typeof scopes)[number],
      ) => {
        savedSettlement = values.isSettled;
        writes.push({ values, splits });
        scopes.push(options);
        return { ...rule, ...values };
      },
      listRecurringOccurrencesForUser: async (_seriesIds: string[], startDate: Date) =>
        startDate.toISOString().startsWith("2026-10")
          ? [
              {
                recurringSeriesId: rule.seriesId,
                purchaseDate: new Date("2026-10-01T00:00:00.000Z"),
                isSettled: true,
              },
            ]
          : [],
      listRecurringSplitsForUser: async () => [],
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
  const input: TransactionInput = {
    type: "expense",
    condition: "recurring",
    paymentMethod: "boleto",
    name: "Conta de energia atualizada",
    amount: 100,
    purchaseDate: "2026-09-01",
    personId: firstPersonId,
    accountId: rule.accountId,
    cardId: null,
    categoryId: rule.categoryId,
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: "2026-09-10",
    boletoPaymentDate: null,
    recurrenceFrequency: "monthly",
    isSettled: true,
  };

  const result = await service.updateRecurringRule(recurringRuleId, userId, input);

  assert.equal(savedSettlement, false);
  assert.equal(result.isSettled, false);
  assert.equal(result.name, "Conta de energia atualizada");

  const laterInput = {
    ...input,
    purchaseDate: "2026-10-01",
    dueDate: "2026-10-10",
    splitShares: [
      { personId: firstPersonId, amount: 60 },
      { personId: secondPersonId, amount: 40 },
    ],
  };
  const singleResult = await service.updateRecurringRule(recurringRuleId, userId, laterInput, {
    scope: "single",
    occurrenceDate: "2026-10-01",
  });
  assert.equal(singleResult.isSettled, true);
  assert.equal(singleResult.dueDate, "2026-10-10");
  await service.updateRecurringRule(recurringRuleId, userId, laterInput, {
    scope: "future",
    occurrenceDate: "2026-10-01",
  });
  assert.deepEqual(writes[1]?.splits, [
    { personId: firstPersonId, amount: "-60.00" },
    { personId: secondPersonId, amount: "-40.00" },
  ]);
  assert.equal(writes[1]?.values.isSettled, false);

  assert.deepEqual(
    scopes.map(({ scope, hasPrevious, previousDate, nextDate }) => ({
      scope,
      hasPrevious,
      previousDate: previousDate.toISOString().slice(0, 10),
      nextDate: nextDate?.toISOString().slice(0, 10) ?? null,
    })),
    [
      { scope: "series", hasPrevious: false, previousDate: "2026-08-31", nextDate: "2026-10-01" },
      { scope: "single", hasPrevious: true, previousDate: "2026-09-30", nextDate: "2026-11-01" },
      { scope: "future", hasPrevious: true, previousDate: "2026-09-30", nextDate: "2026-11-01" },
    ],
  );
  await assert.rejects(() =>
    service.updateRecurringRule(
      recurringRuleId,
      userId,
      { ...laterInput, purchaseDate: "2026-10-02" },
      { scope: "single", occurrenceDate: "2026-10-01" },
    ),
  );
  assert.equal(scopes.length, 3);

  versions.push({
    id: "90000000-0000-4000-8000-000000000009",
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  await service.updateRecurringRule(recurringRuleId, userId, laterInput, {
    scope: "series",
    occurrenceDate: "2026-10-01",
  });
  assert.equal(writes[3]?.values.anchorDate, undefined);
  assert.equal(writes[3]?.values.startDate, undefined);
  assert.equal(writes[3]?.values.frequency, undefined);
  assert.equal(writes[3]?.values.isSettled, undefined);
  await assert.rejects(() =>
    service.updateRecurringRule(
      recurringRuleId,
      userId,
      { ...laterInput, recurrenceFrequency: "weekly" },
      { scope: "series", occurrenceDate: "2026-10-01" },
    ),
  );
  assert.equal(writes.length, 4);
});

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
        anchorDate: new Date("2020-01-04T00:00:00.000Z"),
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
