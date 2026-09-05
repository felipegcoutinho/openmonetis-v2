import type { CreateBillPaymentInput, DashboardBillsOutput } from "@openmonetis/validators/bills";
import { requestApi as request } from "@/lib/api-client";

export function getBills(period: string) {
  return request<DashboardBillsOutput>(`/bills?period=${encodeURIComponent(period)}`);
}

export function payBill(period: string, input: CreateBillPaymentInput) {
  return request<{ id: string; accountId: string; paidAt: string }>(
    `/bills/${encodeURIComponent(period)}/payments`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
