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
  );

  const report = await service.list(userId, {
    period: "2026-09",
    status: "all",
  });

  assert.deepEqual(receivedOptions, { personScope: "admin" });
  assert.equal(report.groups[0]?.originalAmount, 150);
  assert.equal(report.groups[0]?.trackedAmount, 150);
  assert.equal(report.groups[0]?.pendingAmount, 150);
  assert.deepEqual(
    report.groups[0]?.installments.map((item) => item.amount),
    [50, 50, 50],
  );
});
