import { queryOptions } from "@tanstack/react-query";
import {
  getRecentEstablishments,
  getTransaction,
  getTransactions,
  type TransactionsApiSearch,
} from "./transactions.api";

export const transactionKeys = {
  all: ["transactions"] as const,
  list: (search: TransactionsApiSearch) => [...transactionKeys.all, search] as const,
  detail: (id: string) => [...transactionKeys.all, "detail", id] as const,
  recentEstablishments: () => [...transactionKeys.all, "recent-establishments"] as const,
};

export function transactionsQueryOptions(search: TransactionsApiSearch) {
  return queryOptions({
    queryKey: transactionKeys.list(search),
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
