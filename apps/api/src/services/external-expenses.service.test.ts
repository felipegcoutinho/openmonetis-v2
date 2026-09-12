import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateExternalInstallmentAllocationTotal,
  calculateExternalInstallmentTotal,
  canUpdateExternalExpenseSnapshot,
  selectNewExternalExpenseAssignmentKeys,
} from "@openmonetis/domain/external-expenses";
import { buildNotifications } from "@openmonetis/domain/notifications";
import {
  allocateInstallmentShares,
  buildTrackedInstallmentSchedule,
} from "@openmonetis/domain/transactions";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import {
  createExternalExpensesService,
  type ExternalExpenseRecord,
  type ExternalExpensesRepository,
  type RecurringExternalExpenseConnectionRecord,
  type RecurringExternalExpenseDraft,
  type RecurringExternalExpenseSourceRecord,
  synchronizeRecurringExternalExpenses,
} from "./external-expenses.service";

const recipientId = "20000000-0000-4000-8000-000000000002";
const expenseId = "30000000-0000-4000-8000-000000000003";

function expense(overrides: Partial<ExternalExpenseRecord> = {}): ExternalExpenseRecord {
  return {
    id: expenseId,
    connectionId: "40000000-0000-4000-8000-000000000004",
    ownerUserId: "10000000-0000-4000-8000-000000000001",
    recipientUserId: recipientId,
    sourceKind: "transaction",
    sourceTransactionId: "50000000-0000-4000-8000-000000000005",
    sourceSeriesId: null,
    sourceRecurringSeriesId: null,
    sourceRecurringRuleId: null,
    sourceOccurrenceDate: null,
    importedTransactionId: null,
    ownerName: "Pessoa 1",
    ownerAvatarUrl: null,
    status: "pending",
    sourceVersion: 1,
    name: "Compra compartilhada",
    amount: "120.00",
    purchaseDate: new Date("2026-08-10T00:00:00.000Z"),
    period: "2026-08",
    dueDate: null,
    sourcePaymentMethod: "credit_card",
    sourceCondition: "single",
    installmentCount: null,
    currentInstallment: null,
    sourceLabel: "Fatura Visa",
    sourceLogoUrl: null,
    sourceCardBrand: "visa",
    importedAt: null,
    createdAt: new Date("2026-08-10T12:00:00.000Z"),
    updatedAt: new Date("2026-08-10T12:00:00.000Z"),
    ...overrides,
  };
}

function repository(initial = expense()) {
  let current: ExternalExpenseRecord | null = initial;
  const implementation: ExternalExpensesRepository = {
    async listForRecipient() {
      return {
        items: current ? [current] : [],
        total: current ? 1 : 0,
        totalAmount: current ? Number(current.amount) : 0,
      };
    },
    async findForRecipient() {
      return current;
    },
    async installmentAmountsForImport() {
      return [40, 40, 40];
    },
    async summaryForRecipient() {
      const pending = current?.status === "pending" ? current : null;
      return {
        pendingCount: pending ? 1 : 0,
        totalAmount: pending ? Number(pending.amount) : 0,
        counterpartCount: pending ? 1 : 0,
        latestCounterpartName: pending?.ownerName ?? null,
        latestUpdatedAt: pending?.updatedAt ?? null,
        latestPeriod: pending?.period ?? null,
      };
    },
    async listRecurringSourcesForPeriod() {
      return [];
    },
    async listActiveConnections() {
      return [];
    },
    async reconcileRecurringPeriod() {
      return { created: 0, updated: 0, deleted: 0 };
    },
  };
  return {
    implementation,
    markImported() {
      if (!current) return;
      current = {
        ...current,
        status: "imported",
        importedTransactionId: "90000000-0000-4000-8000-000000000009",
        importedAt: new Date("2026-08-11T12:00:00.000Z"),
      };
    },
  };
}

function recurringSource(
  overrides: Partial<RecurringExternalExpenseSourceRecord> = {},
): RecurringExternalExpenseSourceRecord {
  return {
    id: "10000000-0000-4000-8000-000000000010",
    seriesId: "10000000-0000-4000-8000-000000000011",
    ownerUserId: "10000000-0000-4000-8000-000000000001",
    personId: "10000000-0000-4000-8000-000000000012",
    amount: "-50.00",
    startDate: "2026-10-06",
    endDate: null,
    frequency: "weekly",
    splits: [
      { personId: "10000000-0000-4000-8000-000000000012", amount: "-30.00" },
      { personId: "10000000-0000-4000-8000-000000000013", amount: "-20.00" },
    ],
    seriesCreatedAt: new Date("2026-09-01T15:00:00.000Z"),
    name: "Aulas",
    dueDate: null,
    paymentMethod: "pix",
    sourceLabel: "Conta principal",
    card: null,
    ...overrides,
  };
}

function recurringConnection(
  overrides: Partial<RecurringExternalExpenseConnectionRecord> = {},
): RecurringExternalExpenseConnectionRecord {
  return {
    id: "10000000-0000-4000-8000-000000000014",
    ownerUserId: "10000000-0000-4000-8000-000000000001",
    personId: "10000000-0000-4000-8000-000000000013",
    recipientUserId: recipientId,
    connectedAt: new Date("2026-09-15T15:00:00.000Z"),
    ...overrides,
  };
}

function recurringSynchronizationRepository(
  source: RecurringExternalExpenseSourceRecord,
  connection: RecurringExternalExpenseConnectionRecord,
  drafts: RecurringExternalExpenseDraft[],
): ExternalExpensesRepository {
  return {
    ...repository().implementation,
    async listRecurringSourcesForPeriod() {
      return [source];
    },
    async listActiveConnections() {
      return [connection];
    },
    async reconcileRecurringPeriod(input) {
      drafts.push(...input.drafts);
      return { created: input.drafts.length, updated: 0, deleted: 0 };
    },
  };
}

const transactionInput: TransactionInput = {
  type: "expense",
  condition: "installment",
  paymentMethod: "credit_card",
  name: "Compra compartilhada",
  amount: 120,
  purchaseDate: "2026-08-10",
  invoicePeriod: "2026-08",
  personId: "60000000-0000-4000-8000-000000000006",
  accountId: null,
  cardId: "70000000-0000-4000-8000-000000000007",
  categoryId: "80000000-0000-4000-8000-000000000008",
  sourceAccountId: null,
  destinationAccountId: null,
  dueDate: null,
  boletoPaymentDate: null,
  installmentCount: 3,
  startInstallment: 1,
  recurrenceFrequency: null,
  isSettled: null,
  note: null,
  splitShares: null,
};

test("installment sharing preserves the complete purchase amount", () => {
  assert.equal(
    calculateExternalInstallmentTotal({
      originalAmount: 100,
      totalInstallments: 4,
      trackedFromInstallment: 3,
      trackedAmounts: [30, 30],
    }),
    110,
  );
  assert.equal(
    calculateExternalInstallmentAllocationTotal({
      originalTransactionAmount: 120,
      totalInstallments: 3,
      trackedFromInstallment: 2,
      trackedTransactionAmounts: [40, 40],
      trackedAllocationAmounts: [20, 20],
    }),
    60,
  );
});

test("installment import preserves every monthly amount and the total", () => {
  assert.deepEqual(allocateInstallmentShares([13.34, 13.33, 13.33], [20, 20]), [
    [6.67, 6.67],
    [6.67, 6.66],
    [6.66, 6.67],
  ]);
  assert.deepEqual(
    buildTrackedInstallmentSchedule({
      totalAmount: 20.33,
      installmentCount: 3,
      startInstallment: 1,
      trackedAmounts: [7, 6.67, 6.66],
      basePeriod: "2026-09",
      paymentMethod: "credit_card",
    }).map((installment) => installment.amount),
    [7, 6.67, 6.66],
  );
});

test("only pending snapshots can follow source changes", () => {
  assert.equal(canUpdateExternalExpenseSnapshot("pending"), true);
  assert.equal(canUpdateExternalExpenseSnapshot("imported"), false);
});

test("only assignments added after connection are eligible for a new delivery", () => {
  const existing = new Set(["transaction:old:person:p2"]);
  assert.deepEqual([...selectNewExternalExpenseAssignmentKeys(existing, existing)], []);
  assert.deepEqual(
    [
      ...selectNewExternalExpenseAssignmentKeys(
        existing,
        new Set(["transaction:old:person:p2", "transaction:new:person:p2"]),
      ),
    ],
    ["transaction:new:person:p2"],
  );
});

test("pending listing exposes the complete amount for its summary header", async () => {
  const service = createExternalExpensesService(repository().implementation, {
    transactionCreator: {
      async createTransactionFromExternalExpense() {
        throw new Error("must not be called");
      },
    },
  });

  const result = await service.list(
    { view: "pending", period: "2026-08", page: 1, pageSize: 20 },
    recipientId,
  );

  assert.equal(result.total, 1);
  assert.equal(result.totalAmount, 120);
});

test("pending external expenses create one aggregated import notification", () => {
  const notifications = buildNotifications({
    today: "2026-08-20",
    dueSoonDays: 5,
    states: [],
    sources: {
      bills: [],
      invoices: [],
      budgets: [],
      inbox: { pendingCount: 0, latestItemAt: null },
      externalExpenses: {
        pendingCount: 100,
        totalAmount: 8450,
        counterpartCount: 3,
        latestCounterpartName: "Pessoa 1",
        latestUpdatedAt: "2026-08-20T12:00:00.000Z",
        latestPeriod: "2026-09",
      },
      tasks: [],
    },
  });

  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.kind, "externalExpenses");
  assert.equal(notifications[0]?.notificationKey, "externalExpenses:pending");
  assert.equal(
    notifications[0]?.kind === "externalExpenses" ? notifications[0].pendingCount : null,
    100,
  );
  assert.equal(
    notifications[0]?.kind === "externalExpenses" ? notifications[0].totalAmount : null,
    8450,
  );
});

test("import creates a regular independent transaction from the reviewed form", async () => {
  const repo = repository(
    expense({
      sourceSeriesId: "90000000-0000-4000-8000-000000000010",
      sourceCondition: "installment",
      installmentCount: 3,
      currentInstallment: 1,
    }),
  );
  let received: TransactionInput | undefined;
  let receivedInstallmentAmounts: number[] | undefined;
  const service = createExternalExpensesService(repo.implementation, {
    transactionCreator: {
      async createTransactionFromExternalExpense(
        input,
        _userId,
        _expenseId,
        _expectedVersion,
        _confirmedAt,
        installmentAmounts,
      ) {
        received = input;
        receivedInstallmentAmounts = installmentAmounts;
        repo.markImported();
        return { id: "created" } as TransactionOutput;
      },
    },
  });

  const result = await service.importExpense(expenseId, recipientId, {
    expectedVersion: 1,
    transaction: transactionInput,
  });

  assert.equal(received?.paymentMethod, "credit_card");
  assert.deepEqual(receivedInstallmentAmounts, [40, 40, 40]);
  assert.equal(result.expense.status, "imported");
  assert.equal(result.expense.importedTransactionId, "90000000-0000-4000-8000-000000000009");
});

test("import rejects recurring transactions", async () => {
  const repo = repository();
  const service = createExternalExpensesService(repo.implementation, {
    transactionCreator: {
      async createTransactionFromExternalExpense() {
        throw new Error("must not be called");
      },
    },
  });

  await assert.rejects(
    service.importExpense(expenseId, recipientId, {
      expectedVersion: 1,
      transaction: {
        ...transactionInput,
        condition: "recurring",
        installmentCount: null,
        startInstallment: undefined,
        recurrenceFrequency: "monthly",
      },
    }),
  );
});

test("boleto synchronization delivers every occurrence on the first day of its due month", async () => {
  const drafts: RecurringExternalExpenseDraft[] = [];
  const implementation = recurringSynchronizationRepository(
    recurringSource({ dueDate: "2026-10-15", paymentMethod: "boleto" }),
    recurringConnection(),
    drafts,
  );

  const result = await synchronizeRecurringExternalExpenses(
    implementation,
    { period: "2026-10" },
    () => new Date("2026-10-01T06:00:00.000Z"),
  );

  assert.equal(result.created, 4);
  assert.deepEqual(
    drafts.map((draft) => ({
      occurrenceDate: draft.sourceOccurrenceDate,
      dueDate: draft.snapshot.dueDate,
      amount: draft.snapshot.amount,
    })),
    [
      { occurrenceDate: "2026-10-06", dueDate: "2026-10-15", amount: "20.00" },
      { occurrenceDate: "2026-10-13", dueDate: "2026-10-15", amount: "20.00" },
      { occurrenceDate: "2026-10-20", dueDate: "2026-10-15", amount: "20.00" },
      { occurrenceDate: "2026-10-27", dueDate: "2026-10-15", amount: "20.00" },
    ],
  );
});

test("card synchronization delivers occurrences only when their anchored date arrives", async () => {
  const drafts: RecurringExternalExpenseDraft[] = [];
  const implementation = recurringSynchronizationRepository(
    recurringSource({ paymentMethod: "credit_card" }),
    recurringConnection(),
    drafts,
  );

  const result = await synchronizeRecurringExternalExpenses(
    implementation,
    { period: "2026-10" },
    () => new Date("2026-10-13T15:00:00.000Z"),
  );

  assert.equal(result.created, 2);
  assert.deepEqual(
    drafts.map((draft) => draft.sourceOccurrenceDate),
    ["2026-10-06", "2026-10-13"],
  );
});

test("card synchronization keeps the occurrence date and uses the source invoice period", async () => {
  const drafts: RecurringExternalExpenseDraft[] = [];
  const implementation = recurringSynchronizationRepository(
    recurringSource({
      startDate: "2026-08-30",
      frequency: "monthly",
      paymentMethod: "credit_card",
      seriesCreatedAt: new Date("2026-08-30T15:00:00.000Z"),
      card: {
        closingDay: 1,
        closingRuleType: "fixedDay",
        closingOffsetDays: null,
        closingOffsetMode: null,
        dueDay: 10,
      },
    }),
    recurringConnection({ connectedAt: new Date("2026-08-01T15:00:00.000Z") }),
    drafts,
  );

  const result = await synchronizeRecurringExternalExpenses(
    implementation,
    { period: "2026-08" },
    () => new Date("2026-08-30T18:00:00.000Z"),
  );

  assert.equal(result.created, 1);
  assert.deepEqual(
    drafts.map((draft) => ({
      occurrenceDate: draft.sourceOccurrenceDate,
      purchaseDate: draft.snapshot.purchaseDate,
      period: draft.snapshot.period,
    })),
    [{ occurrenceDate: "2026-08-30", purchaseDate: "2026-08-30", period: "2026-09" }],
  );
});

test("a boleto activated after day one does not deliver that month's occurrences", async () => {
  const drafts: RecurringExternalExpenseDraft[] = [];
  const implementation = recurringSynchronizationRepository(
    recurringSource({
      dueDate: "2026-10-15",
      paymentMethod: "boleto",
      seriesCreatedAt: new Date("2026-10-02T15:00:00.000Z"),
    }),
    recurringConnection(),
    drafts,
  );

  const result = await synchronizeRecurringExternalExpenses(
    implementation,
    { period: "2026-10" },
    () => new Date("2026-10-15T15:00:00.000Z"),
  );

  assert.deepEqual(result, { created: 0, updated: 0, deleted: 0 });
  assert.deepEqual(drafts, []);
});

test("a card connection only receives occurrences on or after its activation date", async () => {
  const drafts: RecurringExternalExpenseDraft[] = [];
  const implementation = recurringSynchronizationRepository(
    recurringSource({ paymentMethod: "credit_card" }),
    recurringConnection({ connectedAt: new Date("2026-10-10T15:00:00.000Z") }),
    drafts,
  );

  const result = await synchronizeRecurringExternalExpenses(
    implementation,
    { period: "2026-10" },
    () => new Date("2026-10-13T15:00:00.000Z"),
  );

  assert.equal(result.created, 1);
  assert.deepEqual(
    drafts.map((draft) => draft.sourceOccurrenceDate),
    ["2026-10-13"],
  );
});

test("monthly synchronization never delivers a future month before its first day", async () => {
  let queried = false;
  const repo = repository().implementation;
  repo.listRecurringSourcesForPeriod = async () => {
    queried = true;
    return [];
  };

  const result = await synchronizeRecurringExternalExpenses(
    repo,
    { period: "2026-10" },
    () => new Date("2026-09-30T15:00:00.000Z"),
  );

  assert.deepEqual(result, { created: 0, updated: 0, deleted: 0 });
  assert.equal(queried, false);
});

test("recurring occurrence can only be imported as a single transaction", async () => {
  const repo = repository(
    expense({
      sourceKind: "recurringOccurrence",
      sourceTransactionId: null,
      sourceRecurringSeriesId: "10000000-0000-4000-8000-000000000020",
      sourceRecurringRuleId: "10000000-0000-4000-8000-000000000021",
      sourceOccurrenceDate: new Date("2026-10-05T00:00:00.000Z"),
      sourceCondition: "recurring",
    }),
  );
  const service = createExternalExpensesService(repo.implementation, {
    transactionCreator: {
      async createTransactionFromExternalExpense() {
        throw new Error("must not be called");
      },
    },
  });

  await assert.rejects(
    service.importExpense(expenseId, recipientId, {
      expectedVersion: 1,
      transaction: transactionInput,
    }),
  );
});
