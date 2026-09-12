import type { InboxClearableStatus } from "@openmonetis/domain/inbox";
import type {
  ClearInboxItemsOutput,
  InboxItemOutput,
  InboxItemSummaryOutput,
  InboxPageOutput,
  InboxSnapshotOutput,
} from "@openmonetis/validators/inbox";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { errorMessage: "inbox_request_failed" });
}

export function getInboxItems(search: {
  status: "pending" | "processed" | "discarded";
  sourceAppName?: string;
  notificationDate?: string;
  page: number;
  pageSize?: number;
}) {
  const params = new URLSearchParams({
    status: search.status,
    page: String(search.page),
    pageSize: String(search.pageSize ?? 20),
  });
  if (search.sourceAppName) params.set("sourceAppName", search.sourceAppName);
  if (search.notificationDate) params.set("notificationDate", search.notificationDate);
  return request<InboxPageOutput>(`/inbox?${params.toString()}`);
}

export function getInboxSnapshot(limit = 4) {
  return request<InboxSnapshotOutput>(`/inbox/snapshot?limit=${limit}`);
}

export function getInboxItem(id: string) {
  return request<InboxItemOutput>(`/inbox/${id}`);
}

export function discardInboxItem(id: string) {
  return request<InboxItemSummaryOutput>(`/inbox/${id}/discard`, { method: "POST" });
}

export function restoreInboxItem(id: string) {
  return request<InboxItemSummaryOutput>(`/inbox/${id}/restore`, { method: "POST" });
}

export function confirmInboxItem(id: string, data: TransactionInput) {
  return request<TransactionOutput>(`/inbox/${id}/confirm`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteInboxItem(id: string) {
  return request<{ id: string }>(`/inbox/${id}`, { method: "DELETE" });
}

export function clearInboxItems(status: InboxClearableStatus) {
  return request<ClearInboxItemsOutput>(`/inbox?status=${status}`, { method: "DELETE" });
}
