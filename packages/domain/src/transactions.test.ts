import assert from "node:assert/strict";
import test from "node:test";
import {
  allocateInstallmentShares,
  allocateRefundByResponsibility,
  assertTransferWithinAvailableBalance,
  type BulkTransactionTarget,
  buildTrackedInstallmentSchedule,
  buildTransferPostings,
  calculateRefund,
  canApplyBulkTransactionAction,
  canAssignBulkCategory,
  deriveTransactionPostingDate,
  getPeriodEndDate,
  InsufficientTransferBalanceError,
  isTransactionSelectionItemSelectable,
  listRecurrenceDatesInPeriod,
  previewInstallmentOptions,
  rebalanceTwoAmountShares,
  rebalanceTwoPercentageShares,
  resolveEditedTransactionPeriod,
  selectRecurringRuleVersionsToUpdate,
  splitAmountEqually,
  splitAmountIntoInstallments,
  summarizeTransactionSelection,
  type TransactionSelectionItem,
} from "./transactions";

test("transfers conserve cents between distinct source and destination accounts", () => {
  for (const amount of [0.01, 0.3, 10.01, 999_999_999.99]) {
    const postings = buildTransferPostings({
      sourceAccountId: "source",
      destinationAccountId: "destination",
      amount,
    });
    assert.deepEqual(postings, [
      { accountId: "source", amount: -amount, direction: "outgoing" },
      { accountId: "destination", amount, direction: "incoming" },
    ]);
    assert.equal(
      postings.reduce((total, posting) => total + Math.round(posting.amount * 100), 0),
      0,
    );
  }
});

test("transfers reject missing accounts, identical accounts and invalid amounts", () => {
  for (const [sourceAccountId, destinationAccountId] of [
    ["", "destination"],
    ["source", ""],
    ["same", "same"],
  ]) {
    assert.throws(() =>
      buildTransferPostings({ sourceAccountId, destinationAccountId, amount: 1 }),
    );
  }
  for (const amount of [0, -1, NaN, Infinity, -Infinity]) {
    assert.throws(
      () =>
        buildTransferPostings({
          sourceAccountId: "source",
          destinationAccountId: "destination",
          amount,
        }),
      RangeError,
    );
  }
});

test("transfer balance checks allow the exact balance and tolerate floating point representation", () => {
  for (const [amount, availableBalance] of [
    [10.01, 10.01],
    [0.3, 0.1 + 0.2],
    [0.01, 100],
  ]) {
    assert.doesNotThrow(() => assertTransferWithinAvailableBalance({ amount, availableBalance }));
  }
});

test("transfer balance checks reject overspending, negative balances and nonfinite values", () => {
  for (const [amount, availableBalance] of [
    [10.02, 10.01],
    [0.01, 0],
    [0.01, -1],
    [0, 100],
    [-1, 100],
    [NaN, 100],
    [Infinity, 100],
    [1, NaN],
    [1, Infinity],
  ]) {
    assert.throws(
      () => assertTransferWithinAvailableBalance({ amount, availableBalance }),
      InsufficientTransferBalanceError,
    );
  }
});

test("partial and final refunds consume the remaining original amount exactly", () => {
  assert.deepEqual(
    calculateRefund({
      originalAmount: "-10.01",
      previousRefunds: ["3.33", 3.33],
      refundAmount: 3.35,
    }),
    {
      originalAmount: 10.01,
      refundedAmount: 6.66,
      refundableAmount: 3.35,
      refundAmount: 3.35,
      remainingRefundableAmount: 0,
    },
  );
  assert.equal(
    calculateRefund({ originalAmount: -0.3, previousRefunds: [0.1], refundAmount: 0.2 })
      .remainingRefundableAmount,
    0,
  );
});

test("refunds reject empty, nonfinite, exhausted and excessive amounts", () => {
  for (const refundAmount of [0, NaN, Infinity, 10.02]) {
    assert.throws(
      () => calculateRefund({ originalAmount: -10.01, previousRefunds: [], refundAmount }),
      RangeError,
    );
  }
  assert.throws(
    () => calculateRefund({ originalAmount: 0, previousRefunds: [], refundAmount: 1 }),
    RangeError,
  );
  assert.throws(
    () => calculateRefund({ originalAmount: -10.01, previousRefunds: [10.01], refundAmount: 0.01 }),
    RangeError,
  );
});

test("refund allocations preserve responsibility and redistribute every remaining cent", () => {
  assert.deepEqual(
    allocateRefundByResponsibility(3.33, "admin", [
      { personId: "admin", amount: "-6.00" },
      { personId: "external", amount: "-4.01" },
    ]),
    [
      { personId: "admin", amount: 1.99 },
      { personId: "external", amount: 1.34 },
    ],
  );
  for (const refundAmount of [0.01, 0.02, 3.33, 10.01]) {
    const allocations = allocateRefundByResponsibility(refundAmount, "admin", [
      { personId: "admin", amount: 6 },
      { personId: "external", amount: 4.01 },
    ]);
    assert.equal(
      allocations.reduce((total, share) => total + Math.round(share.amount * 100), 0),
      Math.round(refundAmount * 100),
    );
  }
});

test("refunds without splits belong to the primary person and empty responsibility is rejected", () => {
  assert.deepEqual(allocateRefundByResponsibility(10.01, "admin", []), [
    { personId: "admin", amount: 10.01 },
  ]);
  assert.throws(
    () => allocateRefundByResponsibility(1, "admin", [{ personId: "external", amount: 0 }]),
    RangeError,
  );
});

test("installment previews preserve cent redistribution across the supported counts", () => {
  const options = previewInstallmentOptions(3);
  assert.equal(options.length, 59);
  assert.deepEqual(options[0], { count: 2, minimumAmount: 1.5, maximumAmount: 1.5 });
  assert.deepEqual(
    options.find((option) => option.count === 7),
    {
      count: 7,
      minimumAmount: 0.42,
      maximumAmount: 0.43,
    },
  );
  assert.deepEqual(options.at(-1), { count: 60, minimumAmount: 0.05, maximumAmount: 0.05 });
  assert.deepEqual(previewInstallmentOptions(0.01)[0], {
    count: 2,
    minimumAmount: 0,
    maximumAmount: 0.01,
  });
});

test("metadata edits preserve installment periods while schedule and invoice edits recalculate", () => {
  const current = {
    condition: "installment" as const,
    paymentMethod: "pix" as const,
    purchaseDate: "2026-10-10",
    period: "2026-11",
    dueDate: null,
    cardId: null,
  };
  assert.equal(
    resolveEditedTransactionPeriod({ current, updated: current, derivedPeriod: "2026-10" }),
    "2026-11",
  );
  assert.equal(
    resolveEditedTransactionPeriod({
      current,
      updated: { ...current, purchaseDate: "2026-12-10" },
      derivedPeriod: "2026-12",
    }),
    "2026-12",
  );
  const card = { ...current, paymentMethod: "credit_card" as const, cardId: "card" };
  assert.equal(
    resolveEditedTransactionPeriod({
      current: card,
      updated: card,
      invoicePeriod: "2026-12",
      derivedPeriod: "2026-12",
    }),
    "2026-12",
  );
  assert.equal(
    resolveEditedTransactionPeriod({
      current: card,
      updated: card,
      invoicePeriod: null,
      derivedPeriod: "2026-10",
    }),
    "2026-10",
  );
});

test("posting date follows payment for settled boletos without moving their due period", () => {
  assert.equal(
    deriveTransactionPostingDate({
      paymentMethod: "boleto",
      purchaseDate: "2026-07-20",
      dueDate: "2026-09-10",
      boletoPaymentDate: "2026-08-28",
      isSettled: true,
    }),
    "2026-08-28",
  );
  assert.equal(
    deriveTransactionPostingDate({
      paymentMethod: "boleto",
      purchaseDate: "2026-07-20",
      dueDate: "2026-09-10",
      isSettled: false,
    }),
    null,
  );
});

test("period end uses the final UTC calendar day across month and year boundaries", () => {
  assert.equal(getPeriodEndDate("2026-02").toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(getPeriodEndDate("2024-02").toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(getPeriodEndDate("2026-12").toISOString(), "2026-12-31T00:00:00.000Z");
});

test("recurrence includes its final effective date", () => {
  assert.deepEqual(
    listRecurrenceDatesInPeriod({
      startDate: "2026-09-21",
      endDate: "2026-09-21",
      frequency: "monthly",
      period: "2026-09",
    }),
    ["2026-09-21"],
  );
});

test("versioned recurrence preserves the original calendar anchor", () => {
  assert.deepEqual(
    listRecurrenceDatesInPeriod({
      anchorDate: "2026-01-31",
      startDate: "2026-02-28",
      endDate: null,
      frequency: "monthly",
      period: "2026-03",
    }),
    ["2026-03-31"],
  );
});

test("recurring edit scope selects past, current and future rule versions correctly", () => {
  const versions = [
    { id: "past", startDate: "2026-01-31" },
    { id: "current", startDate: "2026-02-28" },
    { id: "exception", startDate: "2026-03-31" },
    { id: "later", startDate: "2026-04-30" },
  ];
  const selected = (scope: "single" | "future" | "series") =>
    selectRecurringRuleVersionsToUpdate(versions, "current", "2026-02-28", scope).map(
      (rule) => rule.id,
    );

  assert.deepEqual(selected("single"), []);
  assert.deepEqual(selected("future"), ["exception", "later"]);
  assert.deepEqual(selected("series"), ["past", "current", "exception", "later"]);
  assert.deepEqual(
    selectRecurringRuleVersionsToUpdate(
      versions.map((rule) => ({ ...rule, startDate: new Date(`${rule.startDate}T00:00:00Z`) })),
      "current",
      "2026-02-28",
      "future",
    ).map((rule) => rule.id),
    ["exception", "later"],
  );
});

test("transaction selection summarizes visible signed amounts in cents", () => {
  assert.deepEqual(
    summarizeTransactionSelection([
      { amount: 500, origin: "regular", type: "income" },
      { amount: -100.1, origin: "regular", type: "expense" },
      { amount: -219.9, origin: "regular", type: "expense" },
    ]),
    {
      selectedCount: 3,
      inflow: 500,
      outflow: 320,
      balance: 180,
      neutralCount: 0,
    },
  );
});

test("selection excludes technical and neutral movements", () => {
  const items = [
    { amount: -100, origin: "regular", type: "expense" },
    { amount: -100, origin: "invoicePayment", type: "expense" },
    { amount: 250, origin: "accountBalanceAdjustment", type: "income" },
    { amount: -50, origin: "regular", type: "transfer" },
  ] satisfies TransactionSelectionItem[];

  assert.deepEqual(items.map(isTransactionSelectionItemSelectable), [true, false, false, false]);
  assert.deepEqual(summarizeTransactionSelection(items), {
    selectedCount: 4,
    inflow: 0,
    outflow: 100,
    balance: -100,
    neutralCount: 3,
  });
});

test("two amount shares conserve cents when editing either participant", () => {
  assert.deepEqual(rebalanceTwoAmountShares(100, 35.25), [35.25, 64.75]);
  assert.deepEqual(rebalanceTwoAmountShares(10.01, 3.33), [3.33, 6.68]);
  assert.deepEqual(rebalanceTwoAmountShares(0.3, 0.1), [0.1, 0.2]);
  assert.deepEqual(rebalanceTwoAmountShares(10, 0), [0, 10]);
  assert.deepEqual(rebalanceTwoAmountShares(10, 10), [10, 0]);
  assert.deepEqual(rebalanceTwoAmountShares(10, 3.335), [3.34, 6.66]);
  for (const [total, edited] of [
    [10, -1],
    [10, 11],
    [NaN, 1],
    [10, Infinity],
  ]) {
    assert.throws(() => rebalanceTwoAmountShares(total, edited), RangeError);
  }
});

test("two percentage shares complement the edited input without changing precision", () => {
  assert.deepEqual(rebalanceTwoPercentageShares(33.33), [33.33, 66.67]);
  assert.deepEqual(rebalanceTwoPercentageShares(0), [0, 100]);
  assert.deepEqual(rebalanceTwoPercentageShares(100), [100, 0]);
  assert.deepEqual(rebalanceTwoPercentageShares(33.333), [33.333, 66.667]);
  for (const percentage of [-1, 101, NaN, Infinity]) {
    assert.throws(() => rebalanceTwoPercentageShares(percentage), RangeError);
  }
});

test("installment splits conserve both purchase totals and each person's responsibility", () => {
  for (const total of [100.01, 199.99, 999_999.99]) {
    for (const count of [2, 3, 7, 12, 60]) {
      for (const peopleCount of [2, 3, 5]) {
        const installments = splitAmountIntoInstallments(total, count);
        const shares = splitAmountEqually(total, peopleCount);
        const allocations = allocateInstallmentShares(installments, shares);
        const cents = (amount: number) => Math.round(amount * 100);
        assert.equal(
          installments.reduce((sum, value) => sum + cents(value), 0),
          cents(total),
        );
        allocations.forEach((row, index) => {
          assert.equal(
            row.reduce((sum, value) => sum + cents(value), 0),
            cents(installments[index]),
          );
          assert.ok(row.every((value) => value >= 0.01));
        });
        shares.forEach((share, index) => {
          assert.equal(
            allocations.reduce((sum, row) => sum + cents(row[index]), 0),
            cents(share),
          );
        });
      }
    }
  }
});

test("installment allocation rejects mismatched totals and installments too small for every person", () => {
  for (const [installments, shares] of [
    [
      [1, 1],
      [1, 2],
    ],
    [
      [0.01, 0.01],
      [0.01, 0.01],
    ],
    [
      [1, Infinity],
      [1, 1],
    ],
    [[], [1, 1]],
    [[2], [2]],
  ])
    assert.throws(() => allocateInstallmentShares(installments, shares), RangeError);
});

test("tracking a purchase from a later installment preserves numbering, month-end dates and pending siblings", () => {
  const result = buildTrackedInstallmentSchedule({
    totalAmount: 100.01,
    installmentCount: 4,
    startInstallment: 2,
    basePeriod: "2020-01",
    dueDate: "2020-01-31",
    paymentMethod: "pix",
    initialSettlement: true,
  });
  assert.deepEqual(result, [
    {
      currentInstallment: 2,
      amount: 25,
      period: "2020-01",
      dueDate: "2020-01-31",
      isSettled: true,
    },
    {
      currentInstallment: 3,
      amount: 25,
      period: "2020-02",
      dueDate: "2020-02-29",
      isSettled: false,
    },
    {
      currentInstallment: 4,
      amount: 25,
      period: "2020-03",
      dueDate: "2020-03-31",
      isSettled: false,
    },
  ]);
  assert.throws(
    () =>
      buildTrackedInstallmentSchedule({
        totalAmount: 100,
        installmentCount: 3,
        startInstallment: 2,
        trackedAmounts: [60, 60],
        basePeriod: "2020-01",
        paymentMethod: "pix",
      }),
    RangeError,
  );
});

test("bulk actions only reach user-editable movements", () => {
  const regular = {
    origin: "regular",
    type: "expense",
    paymentMethod: "pix",
    cardId: null,
    isSettled: false,
    refundedAmount: 0,
  } satisfies BulkTransactionTarget;
  const generated = { ...regular, origin: "personSettlement" } satisfies BulkTransactionTarget;
  const onCard = {
    ...regular,
    paymentMethod: "credit_card",
    cardId: "card",
  } satisfies BulkTransactionTarget;
  const settled = { ...regular, isSettled: true } satisfies BulkTransactionTarget;
  const refunded = { ...regular, refundedAmount: 10 } satisfies BulkTransactionTarget;
  const refund = { ...regular, origin: "refund", type: "income" } satisfies BulkTransactionTarget;

  assert.equal(canApplyBulkTransactionAction(regular, "rename"), true);
  assert.equal(canApplyBulkTransactionAction(generated, "rename"), false);
  assert.equal(canApplyBulkTransactionAction(regular, "tag"), true);
  assert.equal(canApplyBulkTransactionAction(generated, "tag"), false);
  assert.equal(canApplyBulkTransactionAction(regular, "settle"), true);
  assert.equal(canApplyBulkTransactionAction(settled, "settle"), false);
  assert.equal(canApplyBulkTransactionAction(settled, "unsettle"), true);
  assert.equal(canApplyBulkTransactionAction(onCard, "settle"), false);
  assert.equal(canApplyBulkTransactionAction(regular, "delete"), true);
  assert.equal(canApplyBulkTransactionAction(refund, "delete"), true);
  assert.equal(canApplyBulkTransactionAction(refunded, "delete"), false);
  assert.equal(canApplyBulkTransactionAction(generated, "delete"), false);
});

test("bulk categorization requires a matching user category", () => {
  const expense = {
    origin: "regular",
    type: "expense",
    paymentMethod: "pix",
    cardId: null,
    isSettled: true,
    refundedAmount: 0,
  } satisfies BulkTransactionTarget;

  assert.equal(canAssignBulkCategory(expense, { type: "expense", isSystem: false }), true);
  assert.equal(canAssignBulkCategory(expense, { type: "income", isSystem: false }), false);
  assert.equal(canAssignBulkCategory(expense, { type: "expense", isSystem: true }), false);
  assert.equal(
    canAssignBulkCategory(
      { ...expense, origin: "invoicePayment" },
      { type: "expense", isSystem: false },
    ),
    false,
  );
});
