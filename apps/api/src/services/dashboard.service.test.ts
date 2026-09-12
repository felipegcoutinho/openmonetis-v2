import assert from "node:assert/strict";
import test from "node:test";
import { calculateBudgetOverview, calculateBudgetSpending } from "@openmonetis/domain/budgets";
import {
  createDefaultDashboardWidgetPreferences,
  normalizeDashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import {
  createDashboardService,
  type DashboardRecurringRuleRecord,
  type DashboardRepository,
  type DashboardTransactionRecord,
} from "./dashboard.service";

const userId = "10000000-0000-4000-8000-000000000001";
const recurringRuleId = "20000000-0000-4000-8000-000000000002";
const accountId = "30000000-0000-4000-8000-000000000003";
const cardId = "31000000-0000-4000-8000-000000000003";

const recurringBoleto: DashboardRecurringRuleRecord = {
  id: recurringRuleId,
  accountId,
  adminAmount: "-186.40",
  amount: "-186.40",
  categoryId: "40000000-0000-4000-8000-000000000004",
  categoryIcon: "zap",
  categoryName: "Energia e água",
  cardId: null,
  card: null,
  dueDate: "2026-03-18",
  excludeFromBalance: false,
  frequency: "monthly",
  isSettled: false,
  origin: "regular",
  paymentMethod: "boleto",
  personAvatarUrl: null,
  personId: "50000000-0000-4000-8000-000000000005",
  personName: "Pessoa principal",
  personRole: "admin",
  personStatus: "active",
  sourceAccountId: null,
  sourceExcludeFromBalance: false,
  startDate: "2026-03-03",
  endDate: null,
  destinationAccountId: null,
  destinationExcludeFromBalance: false,
  type: "expense",
};

const repository: DashboardRepository = {
  deleteWidgetPreferences: async () => undefined,
  findWidgetPreferences: async () => null,
  listAdminInvoicePaymentAllocations: async () => [],
  listInvoiceStatuses: async () => [],
  listRecurringOccurrenceStates: async () => [
    {
      recurringRuleId,
      purchaseDate: "2026-08-03",
      boletoPaymentDate: "2026-08-03",
      isSettled: true,
    },
  ],
  listRecurringRules: async () => [recurringBoleto],
  listRecurringPersonSplits: async () => [],
  listTransactionPersonSplits: async () => [],
  listTransactionsThroughPeriod: async () => [],
  saveWidgetPreferences: async () => undefined,
};

test("dashboard posts recurring boletos in each occurrence due month", async () => {
  const service = createDashboardService(repository, { list: async () => [] });

  const snapshot = await service.getSnapshot("2026-08", userId);

  assert.equal(snapshot.metrics.expenses.current, 186.4);
  assert.equal(snapshot.metrics.balance.current, -186.4);
  assert.equal(snapshot.categoryBreakdown.expensesTotal, 186.4);
  assert.equal(snapshot.peopleExpenses.totalAmount, 186.4);
  assert.deepEqual(snapshot.paymentStatus.expenses, {
    confirmed: 186.4,
    pending: 0,
    total: 186.4,
  });
  assert.equal(snapshot.expenseDistribution.totalAmount, 186.4);
});

function boletoRecord(isSettled: boolean): DashboardTransactionRecord {
  return {
    id: "60000000-0000-4000-8000-000000000006",
    accountId,
    adminAmount: "-100.00",
    amount: "-100.00",
    cardId: null,
    categoryId: "40000000-0000-4000-8000-000000000004",
    categoryIcon: "barcode",
    categoryName: "Contas",
    condition: "single",
    excludeFromBalance: false,
    isSettled,
    origin: "regular",
    paymentMethod: "boleto",
    purchaseDate: "2026-08-31",
    dueDate: "2026-09-10",
    boletoPaymentDate: isSettled ? "2026-08-31" : null,
    personAvatarUrl: null,
    personId: "50000000-0000-4000-8000-000000000005",
    personName: "Pessoa principal",
    period: "2026-09",
    personRole: "admin",
    personStatus: "active",
    type: "expense",
  };
}

function accountBalance(period: string, balance: number) {
  return {
    id: accountId,
    name: "Conta principal",
    type: "checking" as const,
    logo: null,
    note: null,
    excludeFromBalance: false,
    isArchived: false,
    summary: { period, income: 0, expenses: 0, balance },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function scenarioRepository(...transactions: DashboardTransactionRecord[]): DashboardRepository {
  return {
    ...repository,
    listRecurringOccurrenceStates: async () => [],
    listRecurringRules: async () => [],
    listTransactionsThroughPeriod: async (_userId, period) =>
      transactions.filter(
        (transaction) =>
          transaction.period <= period || transaction.purchaseDate.slice(0, 7) <= period,
      ),
  };
}

test("early paid boleto affects competence and cash in August without a September forecast", async () => {
  const boleto = boletoRecord(true);
  const service = createDashboardService(scenarioRepository(boleto), {
    list: async (_userId, period) => [accountBalance(period, period < "2026-08" ? 1_000 : 900)],
  });

  const [august, september] = await Promise.all([
    service.getSnapshot("2026-08", userId),
    service.getSnapshot("2026-09", userId),
  ]);

  assert.deepEqual(
    {
      balance: august.metrics.balance.current,
      expenses: august.metrics.expenses.current,
      projected: august.metrics.projected.current,
    },
    { balance: -100, expenses: 100, projected: 900 },
  );
  assert.equal(august.accounts.totalBalance, 900);
  assert.equal(august.categoryBreakdown.expensesTotal, 100);
  assert.equal(august.peopleExpenses.totalAmount, 100);
  assert.equal(august.expenseDistribution.totalAmount, 100);
  assert.equal(august.paymentStatus.expenses.total, 0);
  assert.deepEqual(
    {
      balance: september.metrics.balance.current,
      expenses: september.metrics.expenses.current,
      projected: september.metrics.projected.current,
    },
    { balance: 0, expenses: 0, projected: 900 },
  );
  assert.equal(september.accounts.totalBalance, 900);
  assert.equal(september.categoryBreakdown.expensesTotal, 0);
  assert.equal(september.peopleExpenses.totalAmount, 0);
  assert.equal(september.expenseDistribution.totalAmount, 0);
  assert.deepEqual(september.paymentStatus.expenses, {
    confirmed: 100,
    pending: 0,
    total: 100,
  });
});

test("pending boleto reduces only the September cash forecast", async () => {
  const boleto = boletoRecord(false);
  const service = createDashboardService(scenarioRepository(boleto), {
    list: async (_userId, period) => [accountBalance(period, 1_000)],
  });

  const [august, september] = await Promise.all([
    service.getMetrics("2026-08", userId),
    service.getMetrics("2026-09", userId),
  ]);

  assert.deepEqual(
    {
      balance: august.balance.current,
      expenses: august.expenses.current,
      projected: august.projected.current,
    },
    { balance: -100, expenses: 100, projected: 1_000 },
  );
  assert.deepEqual(
    {
      balance: september.balance.current,
      expenses: september.expenses.current,
      projected: september.projected.current,
    },
    { balance: 0, expenses: 0, projected: 900 },
  );
});

test("forecast ignores pending expenses assigned only to an external person", async () => {
  const adminExpense = {
    ...boletoRecord(false),
    id: "70000000-0000-4000-8000-000000000007",
    paymentMethod: "credit_card" as const,
    cardId,
    purchaseDate: "2026-09-01",
    dueDate: null,
    period: "2026-10",
  };
  const externalExpense = {
    ...adminExpense,
    id: "80000000-0000-4000-8000-000000000008",
    adminAmount: null,
    amount: "-22222.22",
    personId: "90000000-0000-4000-8000-000000000009",
    personName: "Pessoa externa",
    personRole: "external" as const,
  };
  const service = createDashboardService(scenarioRepository(adminExpense, externalExpense), {
    list: async (_userId, period) => [accountBalance(period, 0)],
  });

  const october = await service.getMetrics("2026-10", userId);

  assert.deepEqual(
    {
      balance: october.balance.current,
      expenses: october.expenses.current,
      projected: october.projected.current,
    },
    { balance: -100, expenses: 100, projected: -100 },
  );
});

test("forecast uses only the admin allocation from a split expense", async () => {
  const splitExpense = {
    ...boletoRecord(false),
    id: "a0000000-0000-4000-8000-00000000000a",
    adminAmount: "-250.00",
    amount: "-1000.00",
    paymentMethod: "credit_card" as const,
    cardId,
    purchaseDate: "2026-09-01",
    dueDate: null,
    period: "2026-10",
  };
  const service = createDashboardService(scenarioRepository(splitExpense), {
    list: async (_userId, period) => [accountBalance(period, 1_000)],
  });

  const october = await service.getMetrics("2026-10", userId);

  assert.equal(october.projected.current, 750);
});

test("paying a split boleto preserves the admin-scoped forecast", async () => {
  const pendingBoleto = {
    ...boletoRecord(false),
    adminAmount: "-400.00",
    amount: "-1000.00",
  };
  const paidBoleto = {
    ...pendingBoleto,
    boletoPaymentDate: "2026-09-07",
    isSettled: true,
  };
  const pendingService = createDashboardService(scenarioRepository(pendingBoleto), {
    list: async (_userId, period) => [accountBalance(period, 1_000)],
  });
  const paidService = createDashboardService(scenarioRepository(paidBoleto), {
    list: async (_userId, period) => [accountBalance(period, 600)],
  });

  const [pending, paid] = await Promise.all([
    pendingService.getMetrics("2026-09", userId),
    paidService.getMetrics("2026-09", userId),
  ]);

  assert.equal(pending.projected.current, 600);
  assert.equal(paid.projected.current, 600);
});

test("forecast subtracts a partial payment of the admin invoice allocation", async () => {
  const invoiceExpense = {
    ...boletoRecord(false),
    cardId,
    adminAmount: "-1000.00",
    amount: "-10999.99",
    paymentMethod: "credit_card" as const,
    purchaseDate: "2026-09-01",
    dueDate: null,
    period: "2026-09",
  };
  const service = createDashboardService(
    {
      ...scenarioRepository(invoiceExpense),
      listAdminInvoicePaymentAllocations: async () => [
        { amount: "500.00", cardId, period: "2026-09" },
      ],
    },
    {
      list: async (_userId, period) => [accountBalance(period, 500)],
    },
  );

  const september = await service.getMetrics("2026-09", userId);

  assert.deepEqual(
    {
      balance: september.balance.current,
      expenses: september.expenses.current,
      projected: september.projected.current,
    },
    { balance: -1000, expenses: 1000, projected: 0 },
  );
});

test("invoice reductions preserve the nonnegative unbudgeted spending contract", () => {
  const spending = calculateBudgetSpending(
    [{ categoryId: null, origin: "invoiceAdjustment", type: "expense", amount: "20.00" }],
    [],
    "2026-09",
  );

  assert.equal(spending.uncategorizedActualAmount, -20);
  assert.equal(calculateBudgetOverview([], spending).unbudgetedCommittedAmount, 0);
});

test("invoice reductions decrease expenses instead of contributing to income", async () => {
  const purchase = {
    ...boletoRecord(false),
    id: "b0000000-0000-4000-8000-00000000000b",
    adminAmount: "-100.00",
    amount: "-100.00",
    cardId,
    paymentMethod: "credit_card" as const,
    period: "2026-09",
    purchaseDate: "2026-09-02",
  };
  const reduction = {
    ...purchase,
    id: "c0000000-0000-4000-8000-00000000000c",
    adminAmount: "20.00",
    amount: "20.00",
    categoryName: "Outras receitas",
    origin: "invoiceAdjustment" as const,
    type: "expense" as const,
  };
  const increase = {
    ...purchase,
    id: "d0000000-0000-4000-8000-00000000000d",
    adminAmount: "-10.00",
    amount: "-10.00",
    categoryName: "Outras despesas",
    origin: "invoiceAdjustment" as const,
  };
  const service = createDashboardService(scenarioRepository(purchase, reduction, increase), {
    list: async () => [],
  });

  const snapshot = await service.getSnapshot("2026-09", userId);

  assert.deepEqual(
    {
      balance: snapshot.metrics.balance.current,
      expenses: snapshot.metrics.expenses.current,
      income: snapshot.metrics.income.current,
      projected: snapshot.metrics.projected.current,
    },
    { balance: -90, expenses: 90, income: 0, projected: -90 },
  );
  assert.deepEqual(snapshot.paymentStatus.expenses, {
    confirmed: 0,
    pending: 90,
    total: 90,
  });
  assert.deepEqual(snapshot.paymentStatus.income, {
    confirmed: 0,
    pending: 0,
    total: 0,
  });
  assert.equal(snapshot.peopleExpenses.totalAmount, 90);
  assert.equal(snapshot.categoryBreakdown.incomeTotal, 0);
  assert.equal(snapshot.categoryBreakdown.expensesTotal, 90);
  assert.equal(snapshot.expenseDistribution.totalAmount, 90);
});

test("dashboard upgrades only the old default order without hiding widgets", () => {
  const previous = [
    "accounts",
    "invoices",
    "bills",
    "payment-status",
    "inbox",
    "external-expenses",
    "income-expense-balance",
    "budgets",
    "category-trends",
    "expense-categories",
    "income-categories",
    "category-transactions",
    "people",
    "payment-conditions",
    "payment-methods",
    "installments",
    "recurring-expenses",
    "notes",
  ];
  const result = normalizeDashboardWidgetPreferences({ order: previous, hidden: [] });
  assert.deepEqual(result.order, createDefaultDashboardWidgetPreferences().order);
  assert.equal(result.order.includes("person-settlements"), true);
  assert.deepEqual(result.hidden, []);
  const custom = [...previous].reverse();
  assert.deepEqual(
    normalizeDashboardWidgetPreferences({ order: custom, hidden: ["external-expenses"] }),
    {
      order: custom.map((id) => (id === "external-expenses" ? "person-settlements" : id)),
      hidden: ["person-settlements"],
    },
  );
});

test("payment status includes only admin allocations, regardless of transaction owner", async () => {
  const records: DashboardTransactionRecord[] = [
    { ...boletoRecord(true), amount: "-500.00", adminAmount: "-125.25" },
    { ...boletoRecord(false), amount: "-800.00", adminAmount: "-250.50", personRole: "external" },
    { ...boletoRecord(false), amount: "-900.00", adminAmount: null },
    { ...boletoRecord(true), type: "income", amount: "600.00", adminAmount: "200.00" },
    {
      ...boletoRecord(false),
      type: "income",
      amount: "400.00",
      adminAmount: "100.00",
      personRole: "external",
    },
    {
      ...boletoRecord(true),
      type: "income",
      origin: "refund",
      amount: "50.00",
      adminAmount: "25.00",
    },
    { ...boletoRecord(true), origin: "invoicePayment", adminAmount: "-1000.00" },
    { ...boletoRecord(true), origin: "accountBalanceAdjustment", adminAmount: "-1000.00" },
    { ...boletoRecord(true), type: "transfer", adminAmount: "-1000.00" },
    { ...boletoRecord(true), period: "2026-08", adminAmount: "-1000.00" },
  ];
  const service = createDashboardService(scenarioRepository(...records), { list: async () => [] });
  assert.deepEqual(await service.getPaymentStatus("2026-09", userId), {
    period: "2026-09",
    expenses: { confirmed: 100.25, pending: 250.5, total: 350.75 },
    income: { confirmed: 200, pending: 100, total: 300 },
  });
});

test("payment status counts admin recurring shares and preserves occurrence payment state", async () => {
  const service = createDashboardService(
    {
      ...repository,
      listRecurringRules: async () => [
        { ...recurringBoleto, amount: "-500.00", adminAmount: "-125.25" },
        {
          ...recurringBoleto,
          id: "external-owner",
          amount: "-800.00",
          adminAmount: "-250.50",
          personRole: "external",
        },
        { ...recurringBoleto, id: "external-only", amount: "-900.00", adminAmount: null },
        {
          ...recurringBoleto,
          id: "income",
          type: "income",
          amount: "600.00",
          adminAmount: "200.00",
          personRole: "external",
        },
      ],
    },
    { list: async () => [] },
  );
  assert.deepEqual(await service.getPaymentStatus("2026-08", userId), {
    period: "2026-08",
    expenses: { confirmed: 125.25, pending: 250.5, total: 375.75 },
    income: { confirmed: 0, pending: 200, total: 200 },
  });
});

test("dashboard migrates the recent default order and retains hidden widgets", () => {
  const defaults = createDefaultDashboardWidgetPreferences();
  assert.deepEqual(defaults.order.slice(0, 4), ["accounts", "invoices", "bills", "payment-status"]);
  const recent = ["accounts", "payment-status", "invoices", "bills", ...defaults.order.slice(4)];
  assert.deepEqual(normalizeDashboardWidgetPreferences({ order: recent, hidden: ["notes"] }), {
    order: defaults.order,
    hidden: ["notes"],
  });
});
