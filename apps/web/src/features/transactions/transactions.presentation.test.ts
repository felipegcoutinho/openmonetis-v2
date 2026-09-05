import assert from "node:assert/strict";
import test from "node:test";
import {
  formatInstallmentOption,
  getTransactionDateLabel,
  groupTransactionRows,
} from "./transactions.presentation";

test("installment labels do not hide cent redistribution", () => {
  assert.equal(formatInstallmentOption(3, 2), "2x de R$\u00a01,50");
  assert.equal(formatInstallmentOption(3, 7), "7 parcelas · de R$\u00a00,42 a R$\u00a00,43");
});

test("transaction dates describe their financial meaning", () => {
  assert.equal(getTransactionDateLabel("expense", "single"), "Data da compra");
  assert.equal(getTransactionDateLabel("income", "single"), "Data do recebimento");
  assert.equal(getTransactionDateLabel("transfer", "single"), "Data da transferência");
  assert.equal(getTransactionDateLabel("expense", "recurring"), "Início da recorrência");
});

test("split rows connect by record identity, preserving every visible share", () => {
  const share = (id: string, recordId: string | null, date = "2026-09-05") => ({
    id,
    recordId,
    purchaseDate: date,
    recurringRuleId: null as string | null,
    isDivided: true,
    allocation: { personId: id, personName: id, personAvatarUrl: null, amount: -10 },
  });
  const first = share("first", "purchase");
  const unrelated = share("other", "different-purchase");
  const second = share("second", "purchase");
  const third = share("third", "purchase");
  const input = [first, unrelated, second, third];
  assert.deepEqual(
    groupTransactionRows(input).map(({ transaction, splitConnector }) => [
      transaction.id,
      splitConnector,
    ]),
    [
      ["first", "start"],
      ["second", "middle"],
      ["third", "end"],
      ["other", null],
    ],
  );
  assert.deepEqual(input, [first, unrelated, second, third]);
  assert.equal(groupTransactionRows([second])[0].splitConnector, null);
  assert.deepEqual(
    groupTransactionRows([
      { ...share("a", null), recurringRuleId: "rule" },
      { ...share("b", null, "2026-09-12"), recurringRuleId: "rule" },
      { ...share("c", null), recurringRuleId: "rule" },
    ]).map(({ transaction, splitConnector }) => [transaction.id, splitConnector]),
    [
      ["a", "start"],
      ["c", "end"],
      ["b", null],
    ],
  );
  assert.deepEqual(groupTransactionRows([]), []);
});
