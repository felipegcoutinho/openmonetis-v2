import assert from "node:assert/strict";
import test from "node:test";
import {
  getDefaultTransactionFormValues,
  normalizeTransactionInput,
  type TransactionFormValues,
  validateTransactionForm,
} from "./transaction-form.validation";

const paidBoleto = {
  type: "expense",
  condition: "single",
  paymentMethod: "boleto",
  name: "Conta de energia",
  amount: "100",
  purchaseDate: "2026-08-20",
  invoicePeriod: "",
  personId: "10000000-0000-4000-8000-000000000001",
  accountId: "20000000-0000-4000-8000-000000000002",
  cardId: "",
  categoryId: "30000000-0000-4000-8000-000000000003",
  sourceAccountId: "",
  destinationAccountId: "",
  dueDate: "2026-09-03",
  boletoPaymentDate: "2026-08-20",
  installmentCount: "2",
  startInstallment: "1",
  recurrenceFrequency: "monthly",
  isSettled: "true",
  note: "",
  splitShares: [],
} satisfies TransactionFormValues;

test("paid boleto form preserves a payment date before the due month", () => {
  const input = normalizeTransactionInput(paidBoleto);

  assert.equal(input.dueDate, "2026-09-03");
  assert.equal(input.boletoPaymentDate, "2026-08-20");
  assert.equal(validateTransactionForm({ value: paidBoleto }), undefined);
});

test("paid boleto form requires the effective payment date", () => {
  const validation = validateTransactionForm({
    value: { ...paidBoleto, boletoPaymentDate: "" },
  });

  assert.equal(validation?.fields.boletoPaymentDate, "Informe uma data de pagamento válida.");
});

test("new transactions start pending unless a caller provides another default", () => {
  assert.equal(getDefaultTransactionFormValues([], [], [], "expense").isSettled, "false");
  assert.equal(getDefaultTransactionFormValues([], [], [], "income").isSettled, "false");
  assert.equal(getDefaultTransactionFormValues([], [], [], "transfer").isSettled, "false");
  assert.equal(
    getDefaultTransactionFormValues([], [], [], "expense", undefined, { isSettled: "true" })
      .isSettled,
    "true",
  );
});
