import type { AdjustAccountBalanceInput } from "@openmonetis/validators/accounts";
import { queryOptions } from "@tanstack/react-query";
import { getAccount, getAccounts, previewAccountBalanceAdjustment } from "./accounts.api";
import { getCurrentAccountPeriod } from "./accounts.presentation";

const accountKeys = {
  all: ["accounts"] as const,
  list: (period: string) => ["accounts", "list", period] as const,
  detail: (id: string, period: string) => ["accounts", "detail", id, period] as const,
};

export function accountsQueryOptions(period = getCurrentAccountPeriod()) {
  return queryOptions({
    queryKey: accountKeys.list(period),
    queryFn: () => getAccounts(period),
  });
}

export function accountQueryOptions(id: string, period = getCurrentAccountPeriod()) {
  return queryOptions({
    queryKey: accountKeys.detail(id, period),
    queryFn: () => getAccount(id, period),
  });
}

export function accountBalanceAdjustmentPreviewQueryOptions(
  id: string,
  input: AdjustAccountBalanceInput,
) {
  return queryOptions({
    queryKey: ["accounts", "adjustment-preview", id, input],
    queryFn: () => previewAccountBalanceAdjustment(id, input),
  });
}
