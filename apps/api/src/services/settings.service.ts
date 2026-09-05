import {
  type CategoryCreateDraft,
  createDefaultCategoryDrafts,
} from "@openmonetis/domain/categories";
import {
  type AdminPersonDraft,
  type AuthenticatedUser,
  createAdminPersonDraft,
} from "@openmonetis/domain/people";
import { assertSettingsConfirmation } from "@openmonetis/domain/settings";
import type {
  DeleteSettingsAccountInput,
  DeleteSettingsAccountOutput,
  ResetSettingsInput,
  ResetSettingsOutput,
  SettingsSecurityOutput,
} from "@openmonetis/validators/settings";
import { notFound, serviceUnavailable } from "../utils/errors";
import type { AttachmentStorage } from "../utils/storage";

export type SettingsResetDraft = {
  admin: AdminPersonDraft;
  categories: CategoryCreateDraft[];
};

export type SettingsRepository = {
  findUserById(userId: string): Promise<AuthenticatedUser | null>;
  hasPasswordCredentialForUser(userId: string): Promise<boolean>;
  listAttachmentFileKeysByUser(userId: string): Promise<string[]>;
  resetForUser(userId: string, draft: SettingsResetDraft): Promise<boolean>;
  deleteForUser(userId: string): Promise<boolean>;
};

export function createSettingsService(
  repository: SettingsRepository,
  storage: Pick<AttachmentStorage, "enabled" | "remove">,
) {
  async function removeAttachmentObjects(userId: string) {
    const fileKeys = await repository.listAttachmentFileKeysByUser(userId);
    const storageKeys = [...new Set(fileKeys.flatMap(getAttachmentStorageKeys))];
    if (storageKeys.length > 0 && !storage.enabled) {
      throw serviceUnavailable(
        "Attachment storage is not configured",
        "attachment_storage_unavailable",
      );
    }

    for (const storageKey of storageKeys) {
      await storage.remove(storageKey);
    }
  }

  return {
    async getSecurity(userId: string): Promise<SettingsSecurityOutput> {
      return {
        passwordChangeAvailable: await repository.hasPasswordCredentialForUser(userId),
      };
    },

    async reset(input: ResetSettingsInput, userId: string): Promise<ResetSettingsOutput> {
      assertSettingsConfirmation("reset", input.confirmation);
      const user = await repository.findUserById(userId);
      if (!user) throw notFound("User not found", "user_not_found");

      await removeAttachmentObjects(userId);
      const reset = await repository.resetForUser(userId, {
        admin: createAdminPersonDraft(user),
        categories: createDefaultCategoryDrafts(userId),
      });
      if (!reset) throw notFound("User not found", "user_not_found");

      return { reset: true };
    },

    async deleteAccount(
      input: DeleteSettingsAccountInput,
      userId: string,
    ): Promise<DeleteSettingsAccountOutput> {
      assertSettingsConfirmation("delete", input.confirmation);
      const user = await repository.findUserById(userId);
      if (!user) throw notFound("User not found", "user_not_found");

      await removeAttachmentObjects(userId);
      const deleted = await repository.deleteForUser(userId);
      if (!deleted) throw notFound("User not found", "user_not_found");

      return { deleted: true };
    },
  };
}

function getAttachmentStorageKeys(fileKey: string) {
  const storageKey = fileKey.startsWith("deleting/") ? fileKey.slice("deleting/".length) : fileKey;
  if (!storageKey) return [];
  if (!storageKey.startsWith("pending/")) return [storageKey];

  const uploadId = storageKey.slice("pending/".length);
  return uploadId ? [storageKey, `attachments/${uploadId}`] : [storageKey];
}

export type SettingsService = ReturnType<typeof createSettingsService>;
