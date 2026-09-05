import type {
  CreateTransactionRefundInput,
  ImportTransactionsInput,
  PaginatedTransactionsOutput,
  RecentEstablishmentsOutput,
  TransactionActionScope,
  TransactionImportPreview,
  TransactionImportResult,
  TransactionInput,
  TransactionOutput,
  TransactionRefundOutput,
  UpdateTransactionInput,
} from "@openmonetis/validators/transactions";
import { ApiClientError, requestApi } from "@/lib/api-client";
import type { TransactionsSearch } from "./transactions.presentation";

export type TransactionsApiSearch = Omit<
  TransactionsSearch,
  "people" | "categories" | "accounts" | "cards" | "edit"
> & {
  personIds?: string[];
  categoryIds?: string[];
  accountIds?: string[];
  cardIds?: string[];
};

class TransactionsApiError extends ApiClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "TransactionsApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message }) => new TransactionsApiError(message, code),
    useResponseMessage: true,
  });
}

export function getTransactions(search: TransactionsApiSearch) {
  const params = new URLSearchParams();
  const values: Record<string, string | number | boolean | undefined> = {
    period: search.period,
    q: search.q,
    type: search.type,
    condition: search.condition,
    paymentMethod: search.paymentMethod,
    settlement: search.settlement,
    minAmount: search.minAmount,
    maxAmount: search.maxAmount,
    dateStart: search.dateStart,
    dateEnd: search.dateEnd,
    hasAttachments: search.hasAttachments,
    isDivided: search.isDivided,
    page: search.page,
    pageSize: search.pageSize,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined) params.set(key, String(value));
  }
  for (const [key, values] of Object.entries({
    personIds: search.personIds,
    categoryIds: search.categoryIds,
    accountIds: search.accountIds,
    cardIds: search.cardIds,
  })) {
    if (values?.length) params.set(key, values.join(","));
  }

  return request<PaginatedTransactionsOutput>(`/transactions?${params.toString()}`);
}

export function getTransaction(id: string) {
  return request<TransactionOutput>(`/transactions/${id}`);
}

export function getRecentEstablishments() {
  return request<RecentEstablishmentsOutput>("/transactions/establishments/recent");
}

export function createTransaction(data: TransactionInput) {
  return request<TransactionOutput>("/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function refundTransaction(id: string, data: CreateTransactionRefundInput) {
  return request<TransactionRefundOutput>(`/transactions/${id}/refunds`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function previewTransactionImport(file: File) {
  if (file.size > 5 * 1024 * 1024) throw new Error("IMPORT_FILE_TOO_LARGE");
  const contentBase64 = await readFileAsBase64(file);
  return request<TransactionImportPreview>("/transactions/imports/preview", {
    method: "POST",
    body: JSON.stringify({ fileName: file.name, contentBase64 }),
  });
}

export function getTransactionImportTemplate() {
  return request<{ fileName: string; contentBase64: string }>("/transactions/imports/template");
}

export function importTransactions(data: ImportTransactionsInput) {
  return request<TransactionImportResult>("/transactions/imports", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function undoTransactionImport(batchId: string) {
  return request<{ batchId: string; deleted: number }>(`/transactions/imports/${batchId}`, {
    method: "DELETE",
  });
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("IMPORT_FILE_INVALID"));
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const content = result.split(",", 2)[1];
      if (!content) reject(new Error("IMPORT_FILE_INVALID"));
      else resolve(content);
    };
    reader.readAsDataURL(file);
  });
}

export function updateTransaction(
  id: string,
  data: UpdateTransactionInput,
  scope: TransactionActionScope = "single",
) {
  return request<TransactionOutput>(`/transactions/${id}?scope=${scope}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export function updateRecurringRule(id: string, data: TransactionInput) {
  return request<TransactionOutput>(`/transactions/recurring-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTransaction({
  id,
  scope = "single",
}: {
  id: string;
  scope?: TransactionActionScope;
}) {
  return request<{ id: string }>(`/transactions/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ scope }),
  });
}

export const settleTransactions = (input: { ids: string[]; isSettled: boolean }) =>
  request<{ ids: string[]; isSettled: boolean }>("/transactions/settlement", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const settleRecurringOccurrence = (input: {
  recurringRuleId: string;
  purchaseDate: string;
  isSettled: boolean;
}) =>
  request<typeof input>("/transactions/recurring-occurrences/settlement", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
export const changeRecurringRuleStatus = (input: {
  id: string;
  status: "active" | "paused" | "cancelled";
}) =>
  request<{ id: string; status: string }>(`/transactions/recurring-rules/${input.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: input.status }),
  });
