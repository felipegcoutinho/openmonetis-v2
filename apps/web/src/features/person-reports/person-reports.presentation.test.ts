import assert from "node:assert/strict";
import test from "node:test";
import {
  describePersonReportCommitment,
  describePersonReportComparison,
  describePersonReportSchedule,
  formatPersonReportDate,
  formatPersonReportDeliveryDate,
  formatPersonReportDeliveryMoment,
  formatPersonReportLineCount,
  formatPersonReportScheduleDate,
  getPersonReportDeliveryErrorMessage,
  getPersonReportEmailUnavailableReason,
  getPersonReportGroupLabel,
  getPersonReportLineAmount,
  getPersonReportLineTags,
  isPersonReportPartial,
} from "./person-reports.presentation";

const line = {
  id: "line",
  name: "Mercado",
  purchaseDate: "2026-10-05",
  amount: 40,
  kind: "expense",
  categoryName: null,
  categoryIcon: null,
  currentInstallment: null,
  installmentCount: null,
  isRecurring: false,
} as const;

test("report groups are named by card, then by payment method", () => {
  assert.equal(
    getPersonReportGroupLabel({ cardName: "Nubank", paymentMethod: "credit_card" }),
    "Nubank",
  );
  assert.equal(getPersonReportGroupLabel({ cardName: null, paymentMethod: "pix" }), "Pix");
  assert.equal(getPersonReportGroupLabel({ cardName: null, paymentMethod: null }), "Outros");
});

test("report lines show installments, recurrence and refunds", () => {
  assert.deepEqual(getPersonReportLineTags(line), []);
  assert.deepEqual(
    getPersonReportLineTags({
      ...line,
      currentInstallment: 3,
      installmentCount: 10,
      isRecurring: true,
    }),
    ["3/10", "Recorrente"],
  );
  assert.deepEqual(getPersonReportLineTags({ ...line, kind: "refund" }), ["Estorno"]);
  assert.equal(getPersonReportLineAmount(line), 40);
  assert.equal(getPersonReportLineAmount({ ...line, kind: "refund" }), -40);
});

test("report counts and dates are short", () => {
  assert.equal(formatPersonReportLineCount(1), "1 lançamento");
  assert.equal(formatPersonReportLineCount(4), "4 lançamentos");
  assert.equal(formatPersonReportDate("2026-10-05"), "05/10");
});

test("explains why the report cannot be emailed", () => {
  const person = { name: "Camila", email: "camila@example.com", status: "active" } as const;
  assert.equal(
    getPersonReportEmailUnavailableReason({ emailEnabled: true, person, entryCount: 1 }),
    null,
  );
  assert.match(
    getPersonReportEmailUnavailableReason({ emailEnabled: false, person, entryCount: 1 }) ?? "",
    /não está configurado/,
  );
  assert.equal(
    getPersonReportEmailUnavailableReason({
      emailEnabled: true,
      person: { ...person, email: null },
      entryCount: 1,
    }),
    "Cadastre um e-mail para Camila para enviar o extrato.",
  );
  assert.equal(
    getPersonReportEmailUnavailableReason({ emailEnabled: true, person, entryCount: 0 }),
    "Não há despesas neste mês para enviar.",
  );
});

test("delivery errors become short messages in Portuguese", () => {
  assert.equal(
    getPersonReportDeliveryErrorMessage({ code: "email_delivery_failed", status: 503 }),
    "O e-mail não foi entregue. Tente novamente em instantes.",
  );
  assert.equal(
    getPersonReportDeliveryErrorMessage({ status: 429 }),
    "Muitos envios em pouco tempo. Aguarde alguns minutos.",
  );
  assert.equal(
    getPersonReportDeliveryErrorMessage(new Error("Request failed")),
    "Não foi possível enviar o extrato.",
  );
  assert.equal(formatPersonReportDeliveryDate("2026-11-07T15:30:00.000Z"), "07/11 às 12:30");
});

test("describes each automatic schedule in plain Portuguese", () => {
  assert.equal(
    describePersonReportSchedule({ frequency: "weekly", weekday: 1, monthDays: [] }),
    "Toda segunda-feira",
  );
  assert.equal(
    describePersonReportSchedule({ frequency: "weekly", weekday: 6, monthDays: [] }),
    "Todo sábado",
  );
  assert.equal(
    describePersonReportSchedule({ frequency: "monthly", weekday: null, monthDays: [1] }),
    "Todo dia 1",
  );
  assert.equal(
    describePersonReportSchedule({ frequency: "monthDays", weekday: null, monthDays: [5, 12, 20] }),
    "Dias 5, 12 e 20",
  );
  assert.equal(formatPersonReportScheduleDate("2026-11-16"), "seg., 16/11");
});

test("marks the current month as partial", () => {
  const now = new Date("2026-11-07T12:00:00.000Z");
  assert.equal(isPersonReportPartial("2026-11", now), true);
  assert.equal(isPersonReportPartial("2026-10", now), false);
});

test("shows recent deliveries with a relative moment", () => {
  const now = new Date("2026-11-07T18:00:00.000Z");
  assert.equal(formatPersonReportDeliveryMoment("2026-11-07T17:55:00.000Z", now), "há 5 min");
  assert.equal(formatPersonReportDeliveryMoment("2026-11-07T15:30:00.000Z", now), "hoje às 12:30");
  assert.equal(formatPersonReportDeliveryMoment("2026-11-06T15:30:00.000Z", now), "ontem às 12:30");
  assert.equal(formatPersonReportDeliveryMoment("2026-11-01T15:30:00.000Z", now), "01/11 às 12:30");
});

test("describes the comparison with the previous month and the coming commitments", () => {
  const base = { previousPeriod: "2026-10", previousAmount: 100 };
  assert.deepEqual(
    describePersonReportComparison({ ...base, differenceAmount: 12, changePercentage: 12 }),
    { trend: "up", text: "12% a mais que outubro (+R$\u00a012,00)" },
  );
  assert.equal(
    describePersonReportComparison({ ...base, differenceAmount: 0, changePercentage: 0 }).text,
    "Igual a outubro",
  );
  assert.equal(
    describePersonReportComparison({
      previousPeriod: "2026-10",
      previousAmount: 0,
      differenceAmount: 50,
      changePercentage: null,
    }).text,
    "Sem despesas em outubro",
  );
  assert.equal(
    describePersonReportCommitment({
      period: "2026-12",
      totalAmount: 150,
      entryCount: 3,
      installmentCount: 1,
      recurringCount: 2,
    }),
    "3 lançamentos · 1 parcela · 2 recorrentes",
  );
});
