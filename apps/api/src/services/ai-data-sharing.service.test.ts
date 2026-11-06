import assert from "node:assert/strict";
import test from "node:test";
import type { AiDataScope } from "@openmonetis/domain/ai-data-sharing";
import {
  type AiDataPreviewReader,
  type AiDataRetentionGroup,
  type AiDataSharingRecord,
  createAiDataSharingService,
} from "./ai-data-sharing.service";

const userId = "00000000-0000-4000-8000-000000000001";
const savedAt = new Date("2026-06-15T12:00:00.000Z");

function createRepository() {
  const records = new Map<string, AiDataSharingRecord>();
  const purges: AiDataRetentionGroup[] = [];
  const deletedFor: string[] = [];
  const upsert = (owner: string, changes: Partial<AiDataSharingRecord>) => {
    const record = {
      scopes: [],
      retentionDays: 90,
      ...records.get(owner),
      ...changes,
      updatedAt: savedAt,
    };
    records.set(owner, record);
    return record;
  };
  return {
    records,
    purges,
    deletedFor,
    repository: {
      findByUser: async (owner: string) => records.get(owner) ?? null,
      save: async (owner: string, scopes: AiDataScope[]) => upsert(owner, { scopes }),
      saveRetention: async (owner: string, retentionDays: number | null) =>
        upsert(owner, { retentionDays }),
      async deleteHistory(owner: string) {
        deletedFor.push(owner);
        return { chats: 2, diagnoses: 1 };
      },
      async deleteHistoryBefore(group: AiDataRetentionGroup) {
        purges.push(group);
        return { chats: 1, diagnoses: 1 };
      },
    },
  };
}

test("nothing beyond aggregates is shared until the person allows it", async () => {
  const service = createAiDataSharingService(createRepository().repository);
  assert.deepEqual(await service.get(userId), {
    scopes: [],
    isFull: false,
    retentionDays: 90,
    updatedAt: null,
  });
  assert.deepEqual(await service.scopesFor(userId), []);
});

test("saved permissions are normalized and full sharing is flagged", async () => {
  const { records, repository } = createRepository();
  const service = createAiDataSharingService(repository);

  const partial = await service.update(userId, { scopes: ["people", "accounts"] });
  assert.deepEqual(partial.scopes, ["accounts"]);
  assert.deepEqual(records.get(userId)?.scopes, ["accounts"]);

  const full = await service.update(userId, {
    scopes: ["budgetsAndGoals", "notes", "people", "transactions", "accounts", "categoryNames"],
  });
  assert.equal(full.isFull, true);
  assert.deepEqual(await service.scopesFor(userId), [
    "categoryNames",
    "transactions",
    "people",
    "notes",
    "accounts",
    "budgetsAndGoals",
  ]);
});

test("retention can be shortened or turned off without touching the permissions", async () => {
  const { repository } = createRepository();
  const service = createAiDataSharingService(repository);
  await service.update(userId, { scopes: ["accounts"] });

  assert.equal((await service.updateRetention(userId, { retentionDays: 30 })).retentionDays, 30);
  const kept = await service.updateRetention(userId, { retentionDays: null });
  assert.equal(kept.retentionDays, null);
  assert.deepEqual(kept.scopes, ["accounts"]);
});

test("each retention group is purged with its own cutoff, the default one included", async () => {
  const { purges, repository } = createRepository();
  const service = createAiDataSharingService(repository);
  const now = new Date("2026-11-02T12:00:00.000Z");

  assert.deepEqual(await service.purgeExpired(now), { chats: 4, diagnoses: 4 });
  assert.deepEqual(
    purges.map((group) => [group.kind, "days" in group ? group.days : null, group.before]),
    [
      ["chosen", 30, new Date("2026-10-03T12:00:00.000Z")],
      ["chosen", 90, new Date("2026-08-04T12:00:00.000Z")],
      ["chosen", 365, new Date("2025-11-02T12:00:00.000Z")],
      ["default", null, new Date("2026-08-04T12:00:00.000Z")],
    ],
  );
});

test("deleting the history removes only the person's own chats and diagnoses", async () => {
  const { deletedFor, repository } = createRepository();
  const service = createAiDataSharingService(repository);
  assert.deepEqual(await service.deleteHistory(userId), { chats: 2, diagnoses: 1 });
  assert.deepEqual(deletedFor, [userId]);
});

test("the preview is the exact data a diagnosis would send with the saved permissions", async () => {
  const { repository } = createRepository();
  const described: unknown[] = [];
  const service = createAiDataSharingService(repository, {
    load: async () =>
      ({
        healthInput: {
          history: [],
          totalBalance: 0,
          expenseCategories: [],
          attention: { critical: 0, warning: 0 },
        },
      }) as unknown as Awaited<ReturnType<AiDataPreviewReader["load"]>>,
    async describe(input) {
      described.push(input.scopes);
      return { data: { period: input.period, categories: [{ name: "Categoria 1" }] } } as never;
    },
  });
  await service.update(userId, { scopes: ["accounts"] });

  assert.deepEqual(await service.preview(userId, "2026-11"), {
    period: "2026-11",
    scopes: ["accounts"],
    data: { period: "2026-11", categories: [{ name: "Categoria 1" }] },
  });
  assert.deepEqual(described, [["accounts"]]);
});
