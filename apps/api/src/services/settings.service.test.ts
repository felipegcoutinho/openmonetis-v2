import assert from "node:assert/strict";
import test from "node:test";
import { defaultAdminPersonAvatarUrl } from "@openmonetis/domain/people";
import {
  createSettingsService,
  type SettingsRepository,
  type SettingsResetDraft,
} from "./settings.service";

test("resets the admin person with the default avatar", async () => {
  const resetDrafts: SettingsResetDraft[] = [];
  const repository: SettingsRepository = {
    findUserById: async () => ({
      id: "user-1",
      name: "Admin",
      email: "admin@example.com",
      image: "/avatars/custom.png",
      providerAvatarUrl: "https://example.com/provider-avatar.png",
    }),
    hasPasswordCredentialForUser: async () => true,
    listAttachmentFileKeysByUser: async () => [],
    resetForUser: async (_userId, draft) => {
      resetDrafts.push(draft);
      return true;
    },
    deleteForUser: async () => true,
  };
  const service = createSettingsService(repository, {
    enabled: true,
    remove: async () => undefined,
  });

  await service.reset({ confirmation: "ZERAR" }, "user-1");

  const [resetDraft] = resetDrafts;
  assert.ok(resetDraft);
  assert.equal(resetDraft.admin.avatarUrl, defaultAdminPersonAvatarUrl);
  assert.equal(resetDraft.admin.status, "active");
});

test("reports whether password changes are available", async () => {
  const repository: SettingsRepository = {
    findUserById: async () => null,
    hasPasswordCredentialForUser: async (userId) => userId === "password-user",
    listAttachmentFileKeysByUser: async () => [],
    resetForUser: async () => false,
    deleteForUser: async () => false,
  };
  const service = createSettingsService(repository, {
    enabled: true,
    remove: async () => undefined,
  });

  assert.deepEqual(await service.getSecurity("password-user"), {
    passwordChangeAvailable: true,
  });
  assert.deepEqual(await service.getSecurity("google-user"), {
    passwordChangeAvailable: false,
  });
});
