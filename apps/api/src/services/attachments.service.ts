import { randomUUID } from "node:crypto";
import {
  getAttachmentKind,
  hasAllowedAttachmentSignature,
  isAllowedAttachment,
  normalizeAttachmentFileName,
} from "@openmonetis/domain/attachments";
import type {
  AttachmentListItemOutput,
  AttachmentOutput,
  ConfirmAttachmentInput,
  ListAttachmentsQuery,
  PaginatedAttachmentsOutput,
  PrepareAttachmentInput,
} from "@openmonetis/validators/attachments";
import { badRequest, notFound, serviceUnavailable } from "../utils/errors";
import type { AttachmentStorage } from "../utils/storage";

export type AttachmentRecord = {
  id: string;
  userId: string;
  fileKey: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
};

export type AttachmentLinkRecord = AttachmentRecord & {
  transactionId: string;
  transactionName: string;
  transactionAmount: string;
  transactionType: "income" | "expense" | "transfer";
  purchaseDate: Date;
  transactionPeriod: string;
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  linkedTransactionCount: number;
};

export type AttachmentsRepository = {
  transactionExistsForUser(transactionId: string, userId: string): Promise<boolean>;
  insertPending(data: Omit<AttachmentRecord, "createdAt">): Promise<AttachmentRecord>;
  finalizeAndAttach(
    uploadId: string,
    transactionId: string,
    userId: string,
    pendingKey: string,
    finalKey: string,
  ): Promise<AttachmentRecord | null>;
  listForTransaction(transactionId: string, userId: string): Promise<AttachmentRecord[]>;
  listLinksForPeriod(userId: string, period: string): Promise<AttachmentLinkRecord[]>;
  findForUser(id: string, userId: string): Promise<AttachmentRecord | null>;
  detachFromTransactionForUser(
    transactionId: string,
    attachmentId: string,
    userId: string,
  ): Promise<{ attachment: AttachmentRecord; orphaned: boolean } | null>;
  markForDeletionForUser(id: string, userId: string): Promise<AttachmentRecord | null>;
  markPendingForDeletionForUser(
    uploadId: string,
    userId: string,
    pendingKey: string,
  ): Promise<AttachmentRecord | null>;
  markOrphansForDeletionForUser(userId: string): Promise<AttachmentRecord[]>;
  markExpiredPendingForDeletionForUser(
    userId: string,
    olderThan: Date,
  ): Promise<AttachmentRecord[]>;
  listDeletionTombstonesForUser(userId: string): Promise<AttachmentRecord[]>;
  deleteDeletionTombstoneForUser(
    id: string,
    userId: string,
    tombstoneKey: string,
  ): Promise<AttachmentRecord | null>;
};

type AttachmentGroup = {
  rows: AttachmentLinkRecord[];
  primary: AttachmentLinkRecord;
};

export function createAttachmentsService(
  repository: AttachmentsRepository,
  storage: AttachmentStorage,
) {
  async function assertTransaction(transactionId: string, userId: string) {
    if (!(await repository.transactionExistsForUser(transactionId, userId))) {
      throw notFound("Transaction not found", "transaction_not_found");
    }
  }

  return {
    async prepare(input: PrepareAttachmentInput, userId: string) {
      assertAttachmentStorage(storage);
      await assertTransaction(input.transactionId, userId);
      if (!isAllowedAttachment(input.mimeType, input.fileSize)) {
        throw badRequest("Invalid attachment", "invalid_attachment");
      }

      await cleanupExpiredPendingUploads(repository, storage, userId);
      const uploadId = randomUUID();
      const pendingKey = getPendingFileKey(uploadId);
      await repository.insertPending({
        id: uploadId,
        userId,
        fileKey: pendingKey,
        fileName: normalizeAttachmentFileName(input.fileName),
        fileSize: input.fileSize,
        mimeType: input.mimeType,
      });

      try {
        const prepared = await storage.prepareUpload(pendingKey, input.mimeType, input.fileSize);
        await cleanupExpiredPendingUploads(repository, storage, userId);
        return { uploadId, uploadUrl: prepared.uploadUrl };
      } catch (error) {
        await markAndFinalizePendingDeletion(repository, storage, uploadId, userId, pendingKey);
        throw error;
      }
    },

    async confirm(input: ConfirmAttachmentInput, userId: string) {
      assertAttachmentStorage(storage);
      await assertTransaction(input.transactionId, userId);
      const pendingKey = getPendingFileKey(input.uploadId);
      const finalFileKey = getFinalFileKey(input.uploadId);
      const upload = await repository.findForUser(input.uploadId, userId);
      if (!upload) {
        throw notFound("Attachment upload not found", "attachment_upload_not_found");
      }
      if (upload.fileKey === finalFileKey) {
        const attached = await repository.finalizeAndAttach(
          input.uploadId,
          input.transactionId,
          userId,
          pendingKey,
          finalFileKey,
        );
        if (!attached) {
          throw notFound("Attachment upload not found", "attachment_upload_not_found");
        }
        await removeQuietly(storage, pendingKey);
        return toOutput(attached);
      }
      if (upload.fileKey !== pendingKey) {
        throw badRequest("Invalid attachment key", "invalid_attachment_key");
      }
      if (!isAllowedAttachment(upload.mimeType, upload.fileSize)) {
        await rejectPendingUpload(repository, storage, upload, userId);
        throw badRequest("Invalid attachment", "invalid_attachment");
      }

      let object: Awaited<ReturnType<AttachmentStorage["inspect"]>>;
      try {
        object = await storage.inspect(pendingKey);
      } catch {
        await rejectPendingUpload(repository, storage, upload, userId);
        throw badRequest("Attachment upload not found", "attachment_upload_not_found");
      }

      if (object.size !== upload.fileSize || object.mimeType !== upload.mimeType || !object.etag) {
        await rejectPendingUpload(repository, storage, upload, userId);
        throw badRequest("Attachment validation failed", "attachment_validation_failed");
      }
      if (!hasAllowedAttachmentSignature(object.mimeType, object.bytes)) {
        await rejectPendingUpload(repository, storage, upload, userId);
        throw badRequest("Attachment content is invalid", "invalid_attachment_content");
      }

      await storage.commit(pendingKey, finalFileKey, object.etag);

      try {
        const attachment = await repository.finalizeAndAttach(
          input.uploadId,
          input.transactionId,
          userId,
          pendingKey,
          finalFileKey,
        );
        if (!attachment) {
          await removeQuietly(storage, finalFileKey);
          throw notFound("Attachment upload not found", "attachment_upload_not_found");
        }
        await removeQuietly(storage, pendingKey);
        return toOutput(attachment);
      } catch (error) {
        try {
          const persisted = await repository.findForUser(input.uploadId, userId);
          if (persisted?.fileKey === finalFileKey) {
            const attached = await repository.finalizeAndAttach(
              input.uploadId,
              input.transactionId,
              userId,
              pendingKey,
              finalFileKey,
            );
            if (attached) {
              await removeQuietly(storage, pendingKey);
              return toOutput(attached);
            }
          }
        } catch {
          // Fall through to best-effort object cleanup and preserve the original database error.
        }
        await removeQuietly(storage, finalFileKey);
        throw error;
      }
    },

    async list(userId: string, query: ListAttachmentsQuery): Promise<PaginatedAttachmentsOutput> {
      await retryDeletionTombstones(repository, storage, userId);
      const groups = groupAttachments(await repository.listLinksForPeriod(userId, query.period));
      const people = createPeopleFacets(groups);
      const normalizedQuery = query.q ? normalizeSearch(query.q) : null;
      const matchingGroups = groups
        .map((group) => selectMatchingPrimary(group, query.personId, normalizedQuery))
        .filter((group): group is AttachmentGroup => Boolean(group));
      const counts = {
        all: matchingGroups.length,
        images: matchingGroups.filter(
          (group) => getAttachmentKind(group.primary.mimeType) === "image",
        ).length,
        pdfs: matchingGroups.filter((group) => getAttachmentKind(group.primary.mimeType) === "pdf")
          .length,
      };
      const filteredGroups = query.kind
        ? matchingGroups.filter((group) => getAttachmentKind(group.primary.mimeType) === query.kind)
        : matchingGroups;
      const sortedGroups = filteredGroups.sort(compareAttachmentGroups);
      const pageCount = Math.max(1, Math.ceil(sortedGroups.length / query.pageSize));
      const page = Math.min(query.page, pageCount);
      const start = (page - 1) * query.pageSize;

      return {
        items: sortedGroups.slice(start, start + query.pageSize).map(toListItem),
        total: sortedGroups.length,
        page,
        pageSize: query.pageSize,
        counts,
        people,
      };
    },

    async listForTransaction(transactionId: string, userId: string) {
      await assertTransaction(transactionId, userId);
      return (await repository.listForTransaction(transactionId, userId)).map(toOutput);
    },

    async getDownloadUrl(id: string, userId: string, disposition: "inline" | "attachment") {
      assertAttachmentStorage(storage);
      const attachment = await repository.findForUser(id, userId);
      if (!attachment || attachment.fileKey !== getFinalFileKey(attachment.id)) {
        throw notFound("Attachment not found", "attachment_not_found");
      }
      return storage.signDownload(
        attachment.fileKey,
        normalizeAttachmentFileName(attachment.fileName),
        disposition,
      );
    },

    async detach(transactionId: string, attachmentId: string, userId: string) {
      const detached = await repository.detachFromTransactionForUser(
        transactionId,
        attachmentId,
        userId,
      );
      if (!detached) throw notFound("Attachment not found", "attachment_not_found");
      if (detached.orphaned) {
        await finalizeDeletionTombstone(repository, storage, detached.attachment, userId);
      }
      return { id: attachmentId, transactionId, deleted: detached.orphaned };
    },

    async remove(id: string, userId: string) {
      const tombstone = await repository.markForDeletionForUser(id, userId);
      if (!tombstone) throw notFound("Attachment not found", "attachment_not_found");
      await finalizeDeletionTombstone(repository, storage, tombstone, userId);
      return { id };
    },

    async cleanupOrphans(userId: string) {
      const expiredBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const markingResults = await Promise.allSettled([
        repository.markOrphansForDeletionForUser(userId),
        repository.markExpiredPendingForDeletionForUser(userId, expiredBefore),
      ]);
      for (const result of markingResults) {
        if (result.status === "rejected") {
          console.error("Failed to mark attachments for deletion", result.reason);
        }
      }
      return {
        deletedCount: await retryDeletionTombstones(repository, storage, userId),
      };
    },
  };
}

function toOutput(record: AttachmentRecord): AttachmentOutput {
  return {
    id: record.id,
    fileName: record.fileName,
    fileSize: record.fileSize,
    mimeType: record.mimeType as AttachmentOutput["mimeType"],
    createdAt: record.createdAt.toISOString(),
  };
}

function toListItem(group: AttachmentGroup): AttachmentListItemOutput {
  const record = group.primary;
  return {
    ...toOutput(record),
    linkedTransactionCount: record.linkedTransactionCount,
    transactionId: record.transactionId,
    transactionName: record.transactionName,
    transactionAmount: Number(record.transactionAmount),
    transactionType: record.transactionType,
    purchaseDate: record.purchaseDate.toISOString().slice(0, 10),
    transactionPeriod: record.transactionPeriod,
    personId: record.personId,
    personName: record.personName,
    personAvatarUrl: record.personAvatarUrl,
    categoryName: record.categoryName,
    categoryIcon: record.categoryIcon,
  };
}

function groupAttachments(rows: AttachmentLinkRecord[]) {
  const groups = new Map<string, AttachmentGroup>();
  for (const row of rows) {
    const group = groups.get(row.id);
    if (group) {
      group.rows.push(row);
      if (compareLinkRows(row, group.primary) < 0) group.primary = row;
    } else {
      groups.set(row.id, { rows: [row], primary: row });
    }
  }
  return [...groups.values()];
}

function selectMatchingPrimary(
  group: AttachmentGroup,
  personId: string | undefined,
  normalizedQuery: string | null,
) {
  const matches = group.rows
    .filter(
      (row) =>
        (!personId || row.personId === personId) &&
        (!normalizedQuery || linkMatchesSearch(row, normalizedQuery)),
    )
    .sort(compareLinkRows);
  if (!matches.length) return null;
  return { rows: group.rows, primary: matches[0] };
}

function linkMatchesSearch(row: AttachmentLinkRecord, query: string) {
  return normalizeSearch(
    [row.fileName, row.transactionName, row.personName, row.categoryName].filter(Boolean).join(" "),
  ).includes(query);
}

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
}

function createPeopleFacets(groups: AttachmentGroup[]) {
  const facets = new Map<
    string,
    { id: string; name: string; avatarUrl: string | null; attachmentIds: Set<string> }
  >();
  for (const group of groups) {
    for (const row of group.rows) {
      const facet = facets.get(row.personId);
      if (facet) {
        facet.attachmentIds.add(row.id);
      } else {
        facets.set(row.personId, {
          id: row.personId,
          name: row.personName,
          avatarUrl: row.personAvatarUrl,
          attachmentIds: new Set([row.id]),
        });
      }
    }
  }

  return [...facets.values()]
    .map(({ attachmentIds, ...facet }) => ({ ...facet, count: attachmentIds.size }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function compareAttachmentGroups(left: AttachmentGroup, right: AttachmentGroup) {
  return compareLinkRows(left.primary, right.primary);
}

function compareLinkRows(left: AttachmentLinkRecord, right: AttachmentLinkRecord) {
  return (
    right.purchaseDate.getTime() - left.purchaseDate.getTime() ||
    right.createdAt.getTime() - left.createdAt.getTime() ||
    left.transactionId.localeCompare(right.transactionId)
  );
}

function getPendingFileKey(uploadId: string) {
  return `pending/${uploadId}`;
}

function getFinalFileKey(uploadId: string) {
  return `attachments/${uploadId}`;
}

async function removeQuietly(storage: AttachmentStorage, fileKey: string) {
  try {
    await storage.remove(fileKey);
  } catch (error) {
    console.error("Failed to clean attachment object", { fileKey, error });
  }
}

async function rejectPendingUpload(
  repository: AttachmentsRepository,
  storage: AttachmentStorage,
  upload: AttachmentRecord,
  userId: string,
) {
  await markAndFinalizePendingDeletion(repository, storage, upload.id, userId, upload.fileKey);
}

async function markAndFinalizePendingDeletion(
  repository: AttachmentsRepository,
  storage: AttachmentStorage,
  uploadId: string,
  userId: string,
  pendingKey: string,
) {
  try {
    const marked = await repository.markPendingForDeletionForUser(uploadId, userId, pendingKey);
    const current = marked ?? (await repository.findForUser(uploadId, userId));
    if (!current?.fileKey.startsWith("deleting/")) return false;
    return finalizeDeletionTombstone(repository, storage, current, userId);
  } catch (error) {
    console.error("Failed to mark pending attachment for deletion", { uploadId, error });
    return false;
  }
}

async function cleanupExpiredPendingUploads(
  repository: AttachmentsRepository,
  storage: AttachmentStorage,
  userId: string,
) {
  try {
    const expiredBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await repository.markExpiredPendingForDeletionForUser(userId, expiredBefore);
  } catch (error) {
    console.error("Failed to mark expired pending attachments", error);
  }
  return retryDeletionTombstones(repository, storage, userId);
}

async function retryDeletionTombstones(
  repository: AttachmentsRepository,
  storage: AttachmentStorage,
  userId: string,
) {
  if (!storage.enabled) return 0;

  let tombstones: AttachmentRecord[];
  try {
    tombstones = await repository.listDeletionTombstonesForUser(userId);
  } catch (error) {
    console.error("Failed to list attachment deletion tombstones", error);
    return 0;
  }

  const results = await Promise.all(
    tombstones.map((attachment) =>
      finalizeDeletionTombstone(repository, storage, attachment, userId),
    ),
  );
  return results.filter(Boolean).length;
}

async function finalizeDeletionTombstone(
  repository: AttachmentsRepository,
  storage: AttachmentStorage,
  tombstone: AttachmentRecord,
  userId: string,
) {
  if (!storage.enabled) return false;

  const storageKeys = getTombstoneStorageKeys(tombstone.fileKey);
  if (!storageKeys.length) return false;

  try {
    for (const storageKey of storageKeys) await storage.remove(storageKey);
  } catch (error) {
    console.error("Failed to delete attachment object", { attachmentId: tombstone.id, error });
    return false;
  }

  try {
    return Boolean(
      await repository.deleteDeletionTombstoneForUser(tombstone.id, userId, tombstone.fileKey),
    );
  } catch (error) {
    console.error("Failed to delete attachment tombstone", { attachmentId: tombstone.id, error });
    return false;
  }
}

function assertAttachmentStorage(storage: AttachmentStorage) {
  if (!storage.enabled) {
    throw serviceUnavailable(
      "Attachment storage is not configured",
      "attachment_storage_unavailable",
    );
  }
}

function getTombstoneStorageKeys(tombstoneKey: string) {
  if (!tombstoneKey.startsWith("deleting/")) return [];
  const storageKey = tombstoneKey.slice("deleting/".length);
  if (!storageKey) return [];
  if (!storageKey.startsWith("pending/")) return [storageKey];

  const uploadId = storageKey.slice("pending/".length);
  return uploadId ? [storageKey, getFinalFileKey(uploadId)] : [storageKey];
}

export type AttachmentsService = ReturnType<typeof createAttachmentsService>;
