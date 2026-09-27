import { queryOptions } from "@tanstack/react-query";
import { getInboxItem, getInboxItems, getInboxSnapshot } from "./inbox.api";

export const inboxKeys = {
  all: ["inbox"] as const,
  list: (
    status: string,
    sourceAppName: string | undefined,
    notificationDate: string | undefined,
    ruleId: string | undefined,
    page: number,
  ) =>
    [
      "inbox",
      "list",
      status,
      sourceAppName ?? "all",
      notificationDate ?? "all",
      ruleId ?? "all",
      page,
    ] as const,
  snapshot: () => ["inbox", "snapshot"] as const,
  detail: (id: string) => ["inbox", "detail", id] as const,
};

export function inboxItemsQueryOptions(
  status: "pending" | "processed" | "discarded",
  sourceAppName: string | undefined,
  notificationDate: string | undefined,
  ruleId: string | undefined,
  page: number,
) {
  return queryOptions({
    queryKey: inboxKeys.list(status, sourceAppName, notificationDate, ruleId, page),
    queryFn: () => getInboxItems({ status, sourceAppName, notificationDate, ruleId, page }),
  });
}

export function inboxItemQueryOptions(id: string) {
  return queryOptions({
    queryKey: inboxKeys.detail(id),
    queryFn: () => getInboxItem(id),
    enabled: Boolean(id),
  });
}

export function inboxSnapshotQueryOptions(limit = 4) {
  return queryOptions({
    queryKey: [...inboxKeys.snapshot(), limit],
    queryFn: () => getInboxSnapshot(limit),
  });
}
