import {
  InstallmentOptionsQuerySchema,
  type RecurrenceEndDateQuery,
} from "@openmonetis/validators/transactions";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import {
  getInstallmentOptions,
  getRecentEstablishments,
  getRecurrenceEndDate,
  getTransaction,
  getTransactions,
  type TransactionsApiSearch,
} from "./transactions.api";

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (search: TransactionsApiSearch) => [...transactionKeys.all, search] as const,
  detail: (id: string) => [...transactionKeys.all, "detail", id] as const,
  recentEstablishments: () => [...transactionKeys.all, "recent-establishments"] as const,
  installmentOptions: (amount: number | null) =>
    [...transactionKeys.all, "installment-options", amount] as const,
  recurrenceEndDate: (query: RecurrenceEndDateQuery) =>
    [...transactionKeys.all, "recurrence-end-date", query] as const,
};

export function installmentOptionsQueryOptions(amount: string, enabled: boolean) {
  const parsed = InstallmentOptionsQuerySchema.safeParse({ amount });
  return queryOptions({
    queryKey: transactionKeys.installmentOptions(parsed.success ? parsed.data.amount : null),
    enabled: enabled && parsed.success,
    queryFn: () => getInstallmentOptions(InstallmentOptionsQuerySchema.parse({ amount }).amount),
    staleTime: 60_000,
  });
}

export function recurrenceEndDateQueryOptions(query: RecurrenceEndDateQuery) {
  return queryOptions({
    queryKey: transactionKeys.recurrenceEndDate(query),
    queryFn: () => getRecurrenceEndDate(query),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function transactionsQueryOptions(search: TransactionsApiSearch) {
  return queryOptions({
    queryKey: transactionKeys.list(search),
    placeholderData: keepPreviousData,
    queryFn: () => getTransactions(search),
  });
}

export function transactionDetailQueryOptions(id: string) {
  return queryOptions({
    queryKey: transactionKeys.detail(id),
    queryFn: () => getTransaction(id),
  });
}

export function recentEstablishmentsQueryOptions() {
  return queryOptions({
    queryKey: transactionKeys.recentEstablishments(),
    queryFn: getRecentEstablishments,
    staleTime: 5 * 60 * 1000,
  });
}
