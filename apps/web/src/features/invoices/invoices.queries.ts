import { queryOptions } from "@tanstack/react-query";
import { getInvoices } from "./invoices.api";

const invoiceKeys = {
  all: ["invoices"] as const,
  period: (period: string) => ["invoices", period] as const,
};
export function invoicesQueryOptions(period: string) {
  return queryOptions({ queryKey: invoiceKeys.period(period), queryFn: () => getInvoices(period) });
}
