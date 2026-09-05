import type { CreateBillPaymentInput } from "@openmonetis/validators/bills";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { payBill } from "./bills.api";

export function usePayBillMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ period, input }: { period: string; input: CreateBillPaymentInput }) =>
      payBill(period, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}
