import type {
  CreateTransactionRefundInput,
  ExportTransactionsQuery,
  TransactionActionScope,
  UpdateTransactionInput,
} from "@openmonetis/validators/transactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  applyRecurringRuleAction,
  categorizeTransactions,
  createTransaction,
  deleteTransaction,
  deleteTransactions,
  exportTransactions,
  getTransactionImportTemplate,
  importTransactions,
  previewTransactionImport,
  refundTransaction,
  renameTransactions,
  settleRecurringOccurrence,
  settleTransactions,
  type TransactionsApiSearch,
  tagTransactions,
  undoTransactionImport,
  updateRecurringRule,
  updateTransaction,
} from "./transactions.api";
import { downloadTransactionExport } from "./transactions.presentation";

export function useExportTransactionsMutation() {
  return useMutation({
    mutationFn: async ({
      search,
      format,
    }: {
      search: TransactionsApiSearch;
      format: ExportTransactionsQuery["format"];
    }) => {
      const file = await exportTransactions(search, format);
      downloadTransactionExport(file);
      return { rowCount: file.rowCount };
    },
  });
}

export function useCreateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useRefundTransactionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateTransactionRefundInput }) =>
      refundTransaction(id, data),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function usePreviewTransactionImportMutation() {
  return useMutation({ mutationFn: previewTransactionImport });
}

export function useTransactionImportTemplateMutation() {
  return useMutation({ mutationFn: getTransactionImportTemplate });
}

export function useImportTransactionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importTransactions,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useUndoTransactionImportMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: undoTransactionImport,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useUpdateRecurringRuleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
      scope,
      occurrenceDate,
    }: {
      id: string;
      data: import("@openmonetis/validators/transactions").TransactionInput;
      scope: TransactionActionScope;
      occurrenceDate: string;
    }) => updateRecurringRule(id, data, scope, occurrenceDate),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useUpdateTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      data,
      scope,
    }: {
      id: string;
      data: UpdateTransactionInput;
      scope?: TransactionActionScope;
    }) => updateTransaction(id, data, scope),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useDeleteTransactionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTransaction,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useSettleTransactionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settleTransactions,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useCategorizeTransactionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: categorizeTransactions,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useRenameTransactionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: renameTransactions,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useTagTransactionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tagTransactions,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useDeleteTransactionsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTransactions,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useSettleRecurringOccurrenceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: settleRecurringOccurrence,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
export function useRecurringRuleActionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyRecurringRuleAction,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
