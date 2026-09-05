import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecurringExpensesService,
  type RecurringExpenseRuleRecord,
  type RecurringExpensesRepository,
} from "./recurring-expenses.service";

const userId = "10000000-0000-4000-8000-000000000001";

function recurringRule(id: string, amount: string): RecurringExpenseRuleRecord {
  return {
    id,
    userId,
    personId: "20000000-0000-4000-8000-000000000002",
    type: "expense",
    paymentMethod: "pix",
    name: `Recorrência ${id}`,
    amount,
    adminAmount: amount,
    startDate: new Date("2026-01-01T00:00:00.000Z"),
    endDate: null,
    frequency: "monthly",
    accountId: "30000000-0000-4000-8000-000000000003",
    cardId: null,
    categoryId: "40000000-0000-4000-8000-000000000004",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: null,
    isSettled: false,
    note: null,
    status: "active",
    personName: "Pessoa principal",
    personAvatarUrl: null,
    personRole: "admin",
    accountName: "Conta principal",
    accountLogo: null,
    categoryName: "Assinaturas",
    categoryIcon: "repeat",
    cardName: null,
    cardLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardDueDay: null,
    hasSplits: false,
  };
}

const rules = [
  recurringRule("50000000-0000-4000-8000-000000000005", "-0.10"),
  recurringRule("60000000-0000-4000-8000-000000000006", "-0.20"),
];

const repository: RecurringExpensesRepository = {
  findForUser: async () => null,
  listForPeriod: async () => rules,
  listOccurrenceStates: async () => [],
  listSplitPeople: async () => [],
  versionForUser: async () => false,
};

test("recurring projections preserve cent precision", async () => {
  const service = createRecurringExpensesService(repository, () => "2026-08-30");

  const report = await service.report("2026-08", userId);

  assert.equal(report.summary.projectedTotal, 0.3);
  assert.deepEqual(
    report.projections.map((projection) => projection.total),
    [0.3, 0.3, 0.3],
  );
  assert.ok(report.projections.every((projection) => Number.isInteger(projection.total * 100)));
});
