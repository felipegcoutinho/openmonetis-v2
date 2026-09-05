import type { ListAttachmentsQuery } from "@openmonetis/validators/attachments";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getAttachments, getAttachmentUrl, getTransactionAttachments } from "./attachments.api";

export const attachmentKeys = {
  all: ["attachments"] as const,
  lists: () => [...attachmentKeys.all, "list"] as const,
  list: (query: ListAttachmentsQuery) => [...attachmentKeys.lists(), query] as const,
  transaction: (id: string) => [...attachmentKeys.all, "transaction", id] as const,
  url: (id: string, disposition: "inline" | "attachment") =>
    [...attachmentKeys.all, "url", id, disposition] as const,
};

export const attachmentsQueryOptions = (query: ListAttachmentsQuery) =>
  queryOptions({
    queryKey: attachmentKeys.list(query),
    queryFn: () => getAttachments(query),
    placeholderData: keepPreviousData,
  });

export const transactionAttachmentsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: attachmentKeys.transaction(id),
    queryFn: () => getTransactionAttachments(id),
    enabled: Boolean(id),
  });

export const attachmentUrlQueryOptions = (id: string, enabled = true) =>
  queryOptions({
    queryKey: attachmentKeys.url(id, "inline"),
    queryFn: () => getAttachmentUrl(id, "inline"),
    enabled: enabled && Boolean(id),
    staleTime: 4 * 60 * 1000,
    gcTime: 8 * 60 * 1000,
  });
