import assert from "node:assert/strict";
import test from "node:test";
import {
  describeBulkTransactionAction,
  formatBulkTransactionResult,
  formatDate,
  formatInstallmentOption,
  formatPaymentMethod,
  formatPaymentMethodTable,
  formatTransactionConditionSummary,
  formatTransactionSettlementSummary,
  getTransactionDateLabel,
  getTransactionSettlementAction,
  getTransactionSettlementLabel,
  groupTransactionRows,
  selectBulkTransactionIds,
  validateTransactionsSearch,
} from "./transactions.presentation";

test("balance adjustments identify their internal balance correction", () => {
  assert.equal(formatPaymentMethod(null, "accountBalanceAdjustment"), "Ajuste de saldo");
  assert.equal(formatPaymentMethodTable(null, "accountBalanceAdjustment"), "Ajuste de saldo");
  assert.equal(formatPaymentMethod(null), "Não se aplica");
});

test("installment labels do not hide cent redistribution", () => {
  assert.equal(
    formatInstallmentOption(2, { count: 2, minimumAmount: 1.5, maximumAmount: 1.5 }),
    "2x de R$\u00a01,50",
  );
  assert.equal(
    formatInstallmentOption(7, { count: 7, minimumAmount: 0.42, maximumAmount: 0.43 }),
    "7 parcelas · de R$\u00a00,42 a R$\u00a00,43",
  );
  assert.equal(formatInstallmentOption(7), "7x");
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

test("settlement copy distinguishes receipts, payments and invoice-controlled amounts", () => {
  assert.equal(
    getTransactionSettlementLabel({ type: "income", isSettled: true, paymentMethod: "pix" }),
    "Recebido",
  );
  assert.equal(
    getTransactionSettlementAction({ type: "income", isSettled: false }),
    "Registrar recebimento",
  );
  assert.equal(
    getTransactionSettlementLabel({
      type: "expense",
      isSettled: null,
      paymentMethod: "credit_card",
    }),
    "Pagamento pela fatura",
  );
  assert.equal(
    getTransactionSettlementLabel({ type: "expense", isSettled: false, paymentMethod: "pix" }),
    "Em aberto",
  );
  assert.equal(
    getTransactionSettlementAction({ type: "transfer", isSettled: false }),
    "Confirmar transferência",
  );
  assert.equal(
    validateTransactionsSearch({ settlement: "invoice", sort: "dueDate" }).settlement,
    "invoice",
  );
  assert.equal(validateTransactionsSearch({ sort: "invalid" }).sort, undefined);
});

test("tag filters keep stable identifiers when labels are renamed or deleted", () => {
  const id = "a0000000-0000-4000-8000-000000000001";
  assert.equal(validateTransactionsSearch({ tags: `${id},${id.toUpperCase()}` }).tags, id);
  assert.equal(validateTransactionsSearch({ tags: "viagem" }).tags, undefined);
  assert.equal(validateTransactionsSearch({ tags: "" }).tags, undefined);
});
test("untagged URL filters normalize booleans and clear conflicting tag selections", () => {
  const id = "a0000000-0000-4000-8000-000000000001";
  assert.equal(validateTransactionsSearch({ withoutTags: "true", tags: id }).tags, undefined);
  assert.equal(validateTransactionsSearch({ withoutTags: "true" }).withoutTags, true);
  assert.equal(validateTransactionsSearch({ withoutTags: true }).withoutTags, true);
  assert.equal(validateTransactionsSearch({ withoutTags: "false", tags: id }).tags, id);
  assert.equal(validateTransactionsSearch({ withoutTags: "false" }).withoutTags, undefined);
});

test("details summary describes settlement date and condition progress", () => {
  assert.equal(
    formatTransactionSettlementSummary({
      type: "income",
      isSettled: true,
      paymentMethod: "pix",
      settledDate: "2026-10-12",
      dueDate: null,
    }),
    `Recebido em ${formatDate("2026-10-12")}`,
  );
  assert.equal(
    formatTransactionSettlementSummary({
      type: "expense",
      isSettled: false,
      paymentMethod: "boleto",
      settledDate: null,
      dueDate: "2026-11-05",
    }),
    `Em aberto · vence em ${formatDate("2026-11-05")}`,
  );
  assert.equal(
    formatTransactionSettlementSummary({
      type: "expense",
      isSettled: true,
      paymentMethod: "credit_card",
      settledDate: "2026-10-12",
      dueDate: null,
    }),
    "Pagamento pela fatura",
  );
  assert.equal(
    formatTransactionConditionSummary({
      condition: "installment",
      currentInstallment: 3,
      installmentCount: 10,
      recurrenceFrequency: null,
    }),
    "Parcela 3 de 10",
  );
  assert.equal(
    formatTransactionConditionSummary({
      condition: "recurring",
      currentInstallment: null,
      installmentCount: null,
      recurrenceFrequency: "monthly",
    }),
    "Recorrente · Mensal",
  );
  assert.equal(
    formatTransactionConditionSummary({
      condition: "single",
      currentInstallment: null,
      installmentCount: null,
      recurrenceFrequency: null,
    }),
    "Única",
  );
});

test("bulk selection collapses split shares and skips recurring occurrences", () => {
  const row = (id: string, recordId: string | null, patch: Record<string, unknown> = {}) =>
    ({
      id,
      recordId,
      origin: "regular",
      type: "expense",
      paymentMethod: "pix",
      cardId: null,
      isSettled: false,
      refundedAmount: 0,
      ...patch,
    }) as unknown as Parameters<typeof selectBulkTransactionIds>[0][number];
  const selection = selectBulkTransactionIds(
    [
      row("a:1", "a"),
      row("a:2", "a"),
      row("rule:2026-10-01", null),
      row("b", "b", { origin: "personSettlement" }),
    ],
    (target) => target.origin === "regular",
  );

  assert.deepEqual(selection.ids, ["a"]);
  assert.equal(selection.skippedCount, 2);
  assert.deepEqual(formatBulkTransactionResult("deleted", selection), {
    title: "1 lançamento removido",
    description: "2 ignorados: recorrentes, gerados pelo sistema ou incompatíveis com a ação.",
  });
});

test("bulk action hints show partial reach and why an action is unavailable", () => {
  assert.equal(
    describeBulkTransactionAction("settle", { count: 5, total: 5 }).hint,
    "Marcar como pago",
  );
  assert.equal(
    describeBulkTransactionAction("settle", { count: 3, total: 5 }).hint,
    "Marcar como pago · 3 de 5",
  );
  const unavailable = describeBulkTransactionAction("unsettle", { count: 0, total: 2 });
  assert.equal(unavailable.available, false);
  assert.equal(unavailable.hint, "Marcar em aberto · nenhum selecionado está pago");
});
