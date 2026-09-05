import { createHash } from "node:crypto";
import {
  assertInboxItemTransition,
  type InboxItemStatus,
  InboxTransitionError,
  isInboxNotificationTimestampAllowed,
  normalizeInboxSingleLine,
  summarizePendingInboxBySource,
} from "@openmonetis/domain/inbox";
import type {
  CompanionInboxItemInput,
  InboxItemOutput,
  InboxItemSummaryOutput,
  InboxPageOutput,
  InboxSnapshotOutput,
  ListInboxItemsQuery,
} from "@openmonetis/validators/inbox";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { ApiError, badRequest, conflict, notFound } from "../utils/errors";

export type InboxItemRecord = {
  id: string;
  userId: string;
  deviceTokenId: string | null;
  sourceApp: string;
  sourceAppName: string | null;
  originalTitle: string | null;
  originalText: string;
  notificationTimestamp: Date;
  parsedName: string | null;
  parsedAmount: string | null;
  clientId: string;
  payloadFingerprint: string;
  status: InboxItemStatus;
  transactionId: string | null;
  processedAt: Date | null;
  discardedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InboxItemDraft = Omit<
  InboxItemRecord,
  "id" | "status" | "transactionId" | "processedAt" | "discardedAt" | "createdAt" | "updatedAt"
>;

export type InboxRepository = {
  insertOrFind(draft: InboxItemDraft): Promise<{
    record: InboxItemRecord;
    duplicate: boolean;
  }>;
  listForUser(
    userId: string,
    query: ListInboxItemsQuery,
  ): Promise<{
    items: InboxItemRecord[];
    sourceApps: string[];
    notificationDates: string[];
    total: number;
    counts: Record<InboxItemStatus, number>;
    pendingAmountItems: Array<{ sourceAppName: string | null; amount: string | null }>;
    activeCards: Array<{ id: string; name: string; logo: string | null }>;
    activeAccounts: Array<{ id: string; name: string; logo: string | null }>;
  }>;
  snapshotForUser(
    userId: string,
    limit: number,
  ): Promise<{
    items: InboxItemRecord[];
    pendingCount: number;
  }>;
  findByIdForUser(id: string, userId: string): Promise<InboxItemRecord | null>;
  transactionExistsForUser(transactionId: string, userId: string): Promise<boolean>;
  transitionForUser(input: {
    id: string;
    userId: string;
    expectedStatus: InboxItemStatus;
    targetStatus: InboxItemStatus;
    transactionId?: string | null;
    changedAt: Date;
  }): Promise<InboxItemRecord | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
};

type InboxIngestionContext = {
  deviceTokenId: string;
  userId: string;
};

type InboxTransactionCreator = {
  createTransactionFromInbox(
    input: TransactionInput,
    userId: string,
    inboxItemId: string,
    confirmedAt: Date,
  ): Promise<TransactionOutput>;
};

type InboxBatchResult = {
  clientId: string | null;
  serverId: string | null;
  success: boolean;
  error: string | null;
};

export function createInboxService(
  repository: InboxRepository,
  options: { now?: () => Date; transactionCreator?: InboxTransactionCreator } = {},
) {
  const now = options.now ?? (() => new Date());

  async function ingest(input: CompanionInboxItemInput, context: InboxIngestionContext) {
    const draft = buildDraft(input, context, now());
    const result = await repository.insertOrFind(draft);

    if (result.record.payloadFingerprint !== draft.payloadFingerprint) {
      throw conflict(
        "The notification identifier was already used with different content",
        "inbox_idempotency_conflict",
      );
    }

    return {
      clientId: input.clientId ?? null,
      id: result.record.id,
      duplicate: result.duplicate,
    };
  }

  return {
    ingest,

    async ingestBatch(inputs: CompanionInboxItemInput[], context: InboxIngestionContext) {
      const seen = new Map<string, string>();
      const results: InboxBatchResult[] = [];

      for (const input of inputs) {
        try {
          const draft = buildDraft(input, context, now());
          const previousFingerprint = seen.get(draft.clientId);
          if (previousFingerprint && previousFingerprint !== draft.payloadFingerprint) {
            throw conflict(
              "The notification identifier is duplicated with different content",
              "inbox_idempotency_conflict",
            );
          }
          seen.set(draft.clientId, draft.payloadFingerprint);

          const result = await repository.insertOrFind(draft);
          if (result.record.payloadFingerprint !== draft.payloadFingerprint) {
            throw conflict(
              "The notification identifier was already used with different content",
              "inbox_idempotency_conflict",
            );
          }

          results.push({
            clientId: input.clientId ?? null,
            serverId: result.record.id,
            success: true,
            error: null,
          });
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;

          results.push({
            clientId: input.clientId ?? null,
            serverId: null,
            success: false,
            error: error.code,
          });
        }
      }

      return results;
    },

    async list(query: ListInboxItemsQuery, userId: string): Promise<InboxPageOutput> {
      const result = await repository.listForUser(userId, query);
      const pendingSummary = summarizePendingInboxBySource(
        result.pendingAmountItems.map((item) => ({
          sourceAppName: item.sourceAppName,
          amount: item.amount === null ? null : Number(item.amount),
        })),
        result.activeCards,
        result.activeAccounts,
      );
      return {
        items: result.items.map(toSummaryOutput),
        sourceApps: result.sourceApps,
        notificationDates: result.notificationDates,
        counts: result.counts,
        page: query.page,
        pageSize: query.pageSize,
        total: result.total,
        totalPages: Math.max(1, Math.ceil(result.total / query.pageSize)),
        pendingSummary,
      };
    },

    async snapshot(userId: string, limit: number): Promise<InboxSnapshotOutput> {
      const result = await repository.snapshotForUser(userId, limit);
      return {
        pendingCount: result.pendingCount,
        recentItems: result.items.map((item) => ({
          id: item.id,
          sourceAppName: item.sourceAppName,
          parsedName: item.parsedName,
          parsedAmount: item.parsedAmount === null ? null : Number(item.parsedAmount),
          notificationTimestamp: item.notificationTimestamp.toISOString(),
        })),
      };
    },

    async get(id: string, userId: string): Promise<InboxItemOutput> {
      return toOutput(await findItem(id, userId, repository));
    },

    async discard(id: string, userId: string) {
      return transition(id, userId, "discarded");
    },

    async restore(id: string, userId: string) {
      return transition(id, userId, "pending");
    },

    async process(id: string, transactionId: string, userId: string) {
      const ownedTransaction = await repository.transactionExistsForUser(transactionId, userId);
      if (!ownedTransaction) {
        throw notFound("Transaction not found", "transaction_not_found");
      }
      return transition(id, userId, "processed", transactionId);
    },

    async confirm(id: string, input: TransactionInput, userId: string) {
      const current = await findItem(id, userId, repository);
      assertAllowedTransition(current.status, "processed");
      if (!options.transactionCreator) {
        throw new Error("Inbox transaction creator is not configured");
      }
      return options.transactionCreator.createTransactionFromInbox(input, userId, id, now());
    },

    async remove(id: string, userId: string) {
      const item = await findItem(id, userId, repository);
      if (item.status === "pending") {
        throw badRequest("Pending inbox items cannot be deleted", "pending_inbox_item_read_only");
      }
      const deleted = await repository.deleteForUser(id, userId);
      if (!deleted) throw notFound("Inbox item not found", "inbox_item_not_found");
      return { id };
    },
  };

  async function transition(
    id: string,
    userId: string,
    targetStatus: InboxItemStatus,
    transactionId: string | null = null,
  ): Promise<InboxItemSummaryOutput> {
    const current = await findItem(id, userId, repository);
    assertAllowedTransition(current.status, targetStatus);

    const updated = await repository.transitionForUser({
      id,
      userId,
      expectedStatus: current.status,
      targetStatus,
      transactionId,
      changedAt: now(),
    });
    if (!updated) {
      throw conflict("The inbox item changed. Reload and try again", "inbox_item_state_conflict");
    }
    return toSummaryOutput(updated);
  }
}

function assertAllowedTransition(currentStatus: InboxItemStatus, targetStatus: InboxItemStatus) {
  try {
    assertInboxItemTransition(currentStatus, targetStatus);
  } catch (error) {
    if (!(error instanceof InboxTransitionError)) throw error;
    throw conflict(error.message, error.code);
  }
}

function buildDraft(
  input: CompanionInboxItemInput,
  context: InboxIngestionContext,
  now: Date,
): InboxItemDraft {
  const notificationTimestamp = new Date(input.notificationTimestamp);
  if (!isInboxNotificationTimestampAllowed(notificationTimestamp, now)) {
    throw badRequest(
      "Notification timestamp is outside the accepted range",
      "inbox_notification_timestamp_invalid",
    );
  }

  const normalized = {
    sourceApp: input.sourceApp.trim(),
    sourceAppName: input.sourceAppName ? normalizeInboxSingleLine(input.sourceAppName) : null,
    originalTitle: input.originalTitle ? normalizeInboxSingleLine(input.originalTitle) : null,
    originalText: normalizeInboxSingleLine(input.originalText),
    notificationTimestamp: notificationTimestamp.toISOString(),
    parsedName: input.parsedName ? normalizeInboxSingleLine(input.parsedName) : null,
    parsedAmount: input.parsedAmount ?? null,
  };
  const payloadFingerprint = createHash("sha256")
    .update(JSON.stringify(normalized), "utf8")
    .digest("hex");

  return {
    userId: context.userId,
    deviceTokenId: context.deviceTokenId,
    sourceApp: normalized.sourceApp,
    sourceAppName: normalized.sourceAppName,
    originalTitle: normalized.originalTitle,
    originalText: normalized.originalText,
    notificationTimestamp,
    parsedName: normalized.parsedName,
    parsedAmount: normalized.parsedAmount === null ? null : normalized.parsedAmount.toFixed(2),
    clientId: input.clientId ?? `legacy_${payloadFingerprint}`,
    payloadFingerprint,
  };
}

async function findItem(id: string, userId: string, repository: InboxRepository) {
  const item = await repository.findByIdForUser(id, userId);
  if (!item) throw notFound("Inbox item not found", "inbox_item_not_found");
  return item;
}

function toOutput(record: InboxItemRecord): InboxItemOutput {
  return {
    ...toSummaryOutput(record),
    sourceApp: record.sourceApp,
    originalTitle: record.originalTitle,
    originalText: record.originalText,
  };
}

function toSummaryOutput(record: InboxItemRecord): InboxItemSummaryOutput {
  return {
    id: record.id,
    sourceAppName: record.sourceAppName,
    originalText: record.originalText,
    notificationTimestamp: record.notificationTimestamp.toISOString(),
    parsedName: record.parsedName,
    parsedAmount: record.parsedAmount === null ? null : Number(record.parsedAmount),
    status: record.status,
    transactionId: record.transactionId,
    processedAt: record.processedAt?.toISOString() ?? null,
    discardedAt: record.discardedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type InboxService = ReturnType<typeof createInboxService>;
