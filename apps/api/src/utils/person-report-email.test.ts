import assert from "node:assert/strict";
import test from "node:test";
import type { PersonReportOutput } from "@openmonetis/validators/person-reports";
import {
  buildPersonReportEmail,
  getPersonReportEmailImageId,
  getPersonReportEmailImagePaths,
  inlinePersonReportImageSources,
} from "./person-report-email";

const report: PersonReportOutput = {
  period: "2026-10",
  person: { id: "6c1f0d4e-8a4b-4c1f-9a2e-222222222222", name: "Ana <script>" },
  balance: {
    assignedAmount: 100,
    refundedAmount: 20,
    settledAmount: 100,
    dueAmount: 80,
    coveredAmount: 80,
    balanceAmount: -20,
    receivableAmount: 0,
    creditAmount: 20,
    status: "credit",
  },
  groups: [
    {
      key: "card:1",
      cardId: "6c1f0d4e-8a4b-4c1f-9a2e-333333333333",
      cardName: "Nubank",
      cardLogo: "/logos/nubank.png",
      dueDate: "2026-10-10",
      paymentMethod: "credit_card",
      totalAmount: 80,
      lines: [
        {
          id: "a",
          name: "Restaurante & bar",
          purchaseDate: "2026-10-03",
          amount: 100,
          kind: "expense",
          categoryName: "Alimentação",
          categoryIcon: null,
          currentInstallment: 2,
          installmentCount: 6,
          isRecurring: false,
        },
        {
          id: "b",
          name: "Estorno",
          purchaseDate: "2026-10-09",
          amount: 20,
          kind: "refund",
          categoryName: "Alimentação",
          categoryIcon: null,
          currentInstallment: null,
          installmentCount: null,
          isRecurring: false,
        },
      ],
    },
    {
      key: "card:2",
      cardId: "6c1f0d4e-8a4b-4c1f-9a2e-666666666666",
      cardName: "Cartão externo",
      cardLogo: "https://example.com/logo.png",
      dueDate: null,
      paymentMethod: "credit_card",
      totalAmount: 0,
      lines: [],
    },
  ],
  settlements: [
    {
      id: "6c1f0d4e-8a4b-4c1f-9a2e-444444444444",
      amount: 100,
      receivedAt: "2026-10-20",
      source: "manual",
    },
  ],
  entryCount: 2,
  comparison: {
    previousPeriod: "2026-09",
    previousAmount: 64,
    differenceAmount: 16,
    changePercentage: 25,
  },
  commitments: [
    {
      period: "2026-11",
      totalAmount: 125.4,
      entryCount: 2,
      installmentCount: 1,
      recurringCount: 1,
    },
  ],
};

test("the report email escapes names and shows the balance from the person's side", () => {
  const email = buildPersonReportEmail({
    report,
    senderName: "Felipe",
    message: null,
    issuedAt: new Date("2026-11-07T12:00:00.000Z"),
  });

  assert.equal(email.subject, "Resumo de despesas de Outubro de 2026 · Felipe");
  assert.equal(email.html.includes("<script>"), false);
  assert.equal(email.html.includes("Ana &lt;script&gt;"), true);
  assert.equal(email.html.includes("Restaurante &amp; bar"), true);
  assert.match(email.html, /Crédito a seu favor/);
  assert.match(email.text, /Crédito a seu favor: R\$\s20,00/);
  assert.match(email.text, /03\/10 {2}Restaurante & bar \(2\/6\) {2}R\$\s100,00/);
  assert.match(email.text, /09\/10 {2}Estorno \(Estorno\) {2}-R\$\s20,00/);
  assert.match(email.text, /\(−\) Repasses recebidos: -R\$\s100,00/);
  assert.match(email.text, /Emitido em: 07\/11\/2026/);
  assert.match(email.text, /Responda este e-mail para falar com Felipe/);
  assert.match(email.text, /Nubank · R\$\s80,00 · vence 10\/10/);
  assert.match(email.text, /Comparado a setembro: \+R\$\s16,00 \(25% a mais\)/);
  assert.match(
    email.text,
    /Novembro de 2026: R\$\s125,40 \(2 lançamentos · 1 parcela · 1 recorrente\)/,
  );
  assert.match(email.html, /Próximos meses/);
});

test("embeds only bundled logos and falls back to monograms", () => {
  assert.deepEqual(getPersonReportEmailImagePaths(report), ["/icon-192.png", "/logos/nubank.png"]);

  const withImages = buildPersonReportEmail({
    report,
    senderName: "Felipe",
    issuedAt: new Date("2026-11-07T12:00:00.000Z"),
    imageSources: inlinePersonReportImageSources(["/icon-192.png", "/logos/nubank.png"]),
  });
  assert.equal(
    withImages.html.includes(`cid:${getPersonReportEmailImageId("/logos/nubank.png")}`),
    true,
  );
  assert.equal(withImages.html.includes("example.com"), false);
  assert.match(withImages.html, />C<\/div>/);

  const withoutImages = buildPersonReportEmail({
    report,
    senderName: "Felipe",
    issuedAt: new Date("2026-11-07T12:00:00.000Z"),
  });
  assert.equal(withoutImages.html.includes("cid:"), false);
  assert.match(withoutImages.html, />N<\/div>/);
});

test("an open month is marked as a partial statement", () => {
  const email = buildPersonReportEmail({
    report,
    senderName: "Felipe",
    issuedAt: new Date("2026-10-15T12:00:00.000Z"),
    partial: true,
  });

  assert.equal(email.subject, "Resumo parcial de despesas de Outubro de 2026 · Felipe");
  assert.match(email.html, /Extrato parcial/);
  assert.match(email.text, /registrados até 15\/10\/2026/);
});

test("renders a printable document that loads the bundled images from the web app", () => {
  const document = buildPersonReportEmail({
    report,
    senderName: "Felipe",
    issuedAt: new Date("2026-11-07T12:00:00.000Z"),
    imageSources: new Map([["/logos/nubank.png", "/logos/nubank.png"]]),
    printTitle: "Extrato de Ana - Outubro de 2026",
  });

  assert.match(document.html, /<title>Extrato de Ana - Outubro de 2026<\/title>/);
  assert.match(document.html, /@page\{size:A4/);
  assert.match(document.html, /src="\/logos\/nubank.png"/);
  assert.equal(document.html.includes("cid:"), false);
});
