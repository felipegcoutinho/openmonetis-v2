import assert from "node:assert/strict";
import test from "node:test";
import type { InstallmentReportRow } from "@openmonetis/domain/installments";
import type { InstallmentsRepository } from "./installments.service";
import { createInstallmentsService } from "./installments.service";

const userId = "10000000-0000-4000-8000-000000000001";
const seriesId = "20000000-0000-4000-8000-000000000002";

function installment(currentInstallment: number, period: string): InstallmentReportRow {
  return {
    id: `30000000-0000-4000-8000-00000000000${currentInstallment}`,
    seriesId,
    name: "Compra dividida",
    note: "Garantia estendida incluída.",
    amount: "-50.00",
    purchaseDate: "2026-08-24",
    period,
    dueDate: null,
    currentInstallment,
    paymentMethod: "credit_card",
    isSettled: null,
    invoicePaymentStatus: null,
    totalInstallments: 3,
    trackedFromInstallment: 1,
    originalAmount: "150.00",
    personId: "40000000-0000-4000-8000-000000000004",
    personName: "Felipe",
    personAvatarUrl: null,
    categoryId: null,
    categoryName: null,
    categoryIcon: null,
    cardId: "50000000-0000-4000-8000-000000000005",
    cardName: "Cartao",
    cardLogo: null,
    cardDueDay: 10,
    accountId: null,
    accountName: null,
    accountLogo: null,
  };
}

function repository(listForUser: InstallmentsRepository["listForUser"]): InstallmentsRepository {
  return new Proxy(
    { listForUser },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected repository call: ${String(property)}`);
        };
      },
    },
  ) as InstallmentsRepository;
}

test("installment report uses only the admin person's allocation", async () => {
  let receivedOptions: { personScope?: "admin" | "all" } | undefined;
  const service = createInstallmentsService(
    repository(async (_receivedUserId, options) => {
      receivedOptions = options;
      return [installment(1, "2026-09"), installment(2, "2026-10"), installment(3, "2026-11")];
    }),
    () => "2026-09",
  );

  const report = await service.list(userId, {
    period: "2026-09",
    status: "all",
  });

  assert.deepEqual(receivedOptions, { personScope: "admin" });
  assert.equal(report.groups[0]?.originalAmount, 150);
  assert.equal(report.groups[0]?.trackedAmount, 150);
  assert.equal(report.groups[0]?.pendingAmount, 150);
  assert.equal(report.groups[0]?.note, "Garantia estendida incluída.");
  assert.deepEqual(
    report.groups[0]?.installments.map((item) => item.amount),
    [50, 50, 50],
  );
  assert.equal(report.monthlyHistory.length, 13);
  assert.equal(report.monthlyHistory[0]?.period, "2025-10");
  assert.deepEqual(report.monthlyHistory.slice(-2), [
    { period: "2026-09", totalAmount: 50, activePurchaseCount: 1 },
    { period: "2026-10", totalAmount: 50, activePurchaseCount: 1 },
  ]);
});

test("monthly history and overview stay complete when the list is filtered", async () => {
  const service = createInstallmentsService(
    repository(async () => [
      { ...installment(1, "2026-08"), amount: "-10.10" },
      { ...installment(2, "2026-09"), amount: "-20.20" },
      { ...installment(3, "2026-10"), amount: "-30.30" },
    ]),
    () => "2026-09",
  );

  const report = await service.list(userId, {
    period: "2026-09",
    status: "completed",
  });

  assert.equal(report.groups.length, 0);
  assert.equal(report.summary.totalPendingAmount, 60.6);
  assert.equal(report.summary.dueInPeriodAmount, 20.2);
  assert.deepEqual(report.monthlyHistory.slice(-3), [
    { period: "2026-08", totalAmount: 10.1, activePurchaseCount: 1 },
    { period: "2026-09", totalAmount: 20.2, activePurchaseCount: 1 },
    { period: "2026-10", totalAmount: 30.3, activePurchaseCount: 1 },
  ]);
  const otherReference = await service.list(userId, { period: "2025-01", status: "open" });
  assert.deepEqual(otherReference.monthlyHistory, report.monthlyHistory);
});

test("paid installments remain in monthly history when only open purchases are listed", async () => {
  const service = createInstallmentsService(
    repository(async () =>
      [installment(1, "2026-07"), installment(2, "2026-08"), installment(3, "2026-09")].map(
        (row) => ({ ...row, invoicePaymentStatus: "paid" as const }),
      ),
    ),
    () => "2026-09",
  );

  const report = await service.list(userId, { period: "2026-09", status: "open" });

  assert.equal(report.groups.length, 0);
  assert.equal(report.summary.totalPendingAmount, 0);
  assert.deepEqual(report.monthlyHistory.slice(-3), [
    { period: "2026-08", totalAmount: 50, activePurchaseCount: 1 },
    { period: "2026-09", totalAmount: 50, activePurchaseCount: 1 },
    { period: "2026-10", totalAmount: 0, activePurchaseCount: 0 },
  ]);
});

test("monthly purchase count includes each series once per month", async () => {
  const secondSeriesId = "20000000-0000-4000-8000-000000000003";
  const service = createInstallmentsService(
    repository(async () => [
      installment(1, "2026-09"),
      installment(2, "2026-09"),
      { ...installment(1, "2026-09"), seriesId: secondSeriesId },
    ]),
    () => "2026-09",
  );

  const report = await service.list(userId, { period: "2026-09", status: "all" });

  assert.deepEqual(report.monthlyHistory.at(-2), {
    period: "2026-09",
    totalAmount: 150,
    activePurchaseCount: 2,
  });
});
