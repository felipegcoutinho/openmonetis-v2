import assert from "node:assert/strict";
import test from "node:test";
import {
  createRecurringTransactionsService,
  type RecurringRuleReportRecord,
  type RecurringTransactionsRepository,
} from "./recurring-transactions.service";

function rule(overrides: Partial<RecurringRuleReportRecord> = {}): RecurringRuleReportRecord {
  return {
    id: "rule",
    userId: "owner",
    seriesId: "series",
    anchorDate: new Date("2020-01-31"),
    personId: "admin",
    type: "expense",
    paymentMethod: "pix",
    name: "Shared rent",
    amount: "-100",
    adminAmount: "-60",
    startDate: new Date("2020-01-31"),
    endDate: null,
    frequency: "monthly",
    accountId: "account",
    cardId: null,
    categoryId: "category",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: null,
    isSettled: false,
    note: null,
    status: "active",
    personName: "Owner",
    personAvatarUrl: null,
    personRole: "admin",
    accountName: "Checking",
    accountLogo: null,
    categoryName: "Home",
    categoryIcon: null,
    cardName: null,
    cardLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardClosingDayPurchasesNextInvoice: null,
    cardDueDay: null,
    hasSplits: true,
    ...overrides,
  };
}
function fixture(rules: RecurringRuleReportRecord[]) {
  const selected: string[][] = [];
  let today = "2020-02-01";
  const repository: RecurringTransactionsRepository = {
    async listForReport(userId, type) {
      assert.equal(userId, "owner");
      assert.equal(type, "expense");
      return rules;
    },
    async listSplitPeople(userId, ids) {
      assert.equal(userId, "owner");
      selected.push(ids);
      return [
        {
          recurringRuleId: "rule",
          personId: "guest",
          personName: "Guest",
          personAvatarUrl: null,
          amount: "-40",
        },
        {
          recurringRuleId: "unrelated",
          personId: "unrelated",
          personName: "Unrelated",
          personAvatarUrl: null,
          amount: "-500",
        },
      ];
    },
  };
  return {
    selected,
    setToday(value: string) {
      today = value;
    },
    service: createRecurringTransactionsService(repository, () => today),
  };
}

test("recurring reports use the owner's effective share and exclude series with no owner allocation", async () => {
  const f = fixture([
    rule({
      occurrenceOverrides: {
        "2020-02-29": {
          isSettled: true,
          amount: "-90.01",
          allocations: [
            { personId: "admin", role: "admin", amount: "-54.01" },
            { personId: "guest", amount: "-36" },
          ],
        },
      },
    }),
    rule({ id: "external-only", seriesId: "external", adminAmount: null }),
  ]);
  const result = await f.service.report({ type: "expense" }, "owner");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].amount, 60);
  assert.equal(result.items[0].totalAmount, 100);
  assert.equal(result.summary.projectedTotal, 54.01);
  assert.deepEqual(
    result.projections.slice(0, 3).map((item) => item.total),
    [54.01, 60, 60],
  );
  assert.deepEqual(
    result.items[0].splitPeople.map((person) => person.id),
    ["guest"],
  );
  assert.deepEqual(f.selected, [["rule"]]);
  assert.equal(JSON.stringify(result).includes('"userId"'), false);
});

test("recurring reports select one version per series while preserving historical and future prices", async () => {
  const f = fixture([
    rule({ id: "old", versionEndDate: new Date("2020-02-29"), endDate: new Date("2020-12-31") }),
    rule({
      id: "new",
      startDate: new Date("2020-03-01"),
      amount: "-200",
      adminAmount: "-120",
      recurrenceEndDate: new Date("2020-04-30"),
    }),
  ]);
  const result = await f.service.report({ type: "expense" }, "owner");
  assert.deepEqual(
    result.items.map((item) => item.id),
    ["old"],
  );
  assert.deepEqual(
    result.projections.slice(0, 3).map((item) => item.total),
    [60, 120, 120],
  );
  f.setToday("2020-03-01");
  const march = await f.service.report({ type: "expense" }, "owner");
  assert.deepEqual(
    march.items.map((item) => item.id),
    ["new"],
  );
  assert.equal(march.items[0].recurrenceEndDate, "2020-04-30");
  assert.deepEqual(
    march.projections.slice(0, 3).map((item) => item.total),
    [120, 120, 0],
  );
});

test("paused and ended series remain visible without editable actions or projected expenses", async () => {
  const f = fixture([
    rule({ status: "paused" }),
    rule({ id: "ended", seriesId: "ended", recurrenceEndDate: new Date("2020-01-31") }),
  ]);
  const result = await f.service.report({ type: "expense" }, "owner");
  assert.equal(result.summary.projectedTotal, 0);
  assert.deepEqual(
    result.items.map((item) => [item.status, item.canEdit]),
    [
      ["paused", false],
      ["ended", false],
    ],
  );
  assert.ok(result.items.every((item) => item.nextOccurrenceDate === null));
});
