import { queryOptions } from "@tanstack/react-query";
import { getBills } from "./bills.api";

const billKeys = {
  all: ["bills"] as const,
  period: (period: string) => ["bills", period] as const,
};

export function billsQueryOptions(period: string) {
  return queryOptions({ queryKey: billKeys.period(period), queryFn: () => getBills(period) });
}
