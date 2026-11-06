import {
  type AiDataRetentionDays,
  type AiDataScope,
  aiDataRetentionCutoff,
  aiDataRetentionDaysOptions,
  defaultAiDataRetentionDays,
  isFullAiDataSharing,
  normalizeAiDataScopes,
} from "@openmonetis/domain/ai-data-sharing";
import { calculateFinancialHealth } from "@openmonetis/domain/ai-diagnoses";
import type {
  AiDataHistoryDeletedOutput,
  AiDataPreviewOutput,
  AiDataSharingOutput,
  UpdateAiDataRetentionInput,
  UpdateAiDataSharingInput,
} from "@openmonetis/validators/ai-data-sharing";
import type { AiFinancialContextReader } from "./ai-context.service";

export type AiDataSharingRecord = {
  scopes: AiDataScope[];
  retentionDays: number | null;
  updatedAt: Date;
};

export type AiDataHistoryCounts = { chats: number; diagnoses: number };

/** Who a purge applies to: people who chose `days`, or people who never saved a preference. */
export type AiDataRetentionGroup =
  | { kind: "chosen"; days: number; before: Date }
  | { kind: "default"; before: Date };

export type AiDataSharingRepository = {
  findByUser(userId: string): Promise<AiDataSharingRecord | null>;
  save(userId: string, scopes: AiDataScope[]): Promise<AiDataSharingRecord>;
  saveRetention(userId: string, retentionDays: number | null): Promise<AiDataSharingRecord>;
  deleteHistory(userId: string): Promise<AiDataHistoryCounts>;
  deleteHistoryBefore(group: AiDataRetentionGroup): Promise<AiDataHistoryCounts>;
};

function retentionOf(record: AiDataSharingRecord | null): AiDataRetentionDays {
  if (!record) return defaultAiDataRetentionDays;
  if (record.retentionDays === null) return null;
  return (
    aiDataRetentionDaysOptions.find((option) => option === record.retentionDays) ??
    defaultAiDataRetentionDays
  );
}

function toOutput(record: AiDataSharingRecord | null): AiDataSharingOutput {
  const scopes = normalizeAiDataScopes(record?.scopes ?? []);
  return {
    scopes,
    isFull: isFullAiDataSharing(scopes),
    retentionDays: retentionOf(record),
    updatedAt: record?.updatedAt.toISOString() ?? null,
  };
}

function addCounts(left: AiDataHistoryCounts, right: AiDataHistoryCounts): AiDataHistoryCounts {
  return { chats: left.chats + right.chats, diagnoses: left.diagnoses + right.diagnoses };
}

/** Reads the same financial data the diagnoses and chats send; see `ai-context.service`. */
export type AiDataPreviewReader = Pick<AiFinancialContextReader, "load" | "describe">;

export function createAiDataSharingService(
  repository: AiDataSharingRepository,
  context?: AiDataPreviewReader,
) {
  return {
    async get(userId: string): Promise<AiDataSharingOutput> {
      return toOutput(await repository.findByUser(userId));
    },

    async update(userId: string, input: UpdateAiDataSharingInput): Promise<AiDataSharingOutput> {
      return toOutput(await repository.save(userId, normalizeAiDataScopes(input.scopes)));
    },

    async updateRetention(
      userId: string,
      input: UpdateAiDataRetentionInput,
    ): Promise<AiDataSharingOutput> {
      return toOutput(await repository.saveRetention(userId, input.retentionDays));
    },

    /** Deletes every AI chat and diagnosis of the person; permissions and logins stay. */
    async deleteHistory(userId: string): Promise<AiDataHistoryDeletedOutput> {
      return repository.deleteHistory(userId);
    },

    /** Deletes, for everyone, the chats and diagnoses past each person's retention. */
    async purgeExpired(now: Date): Promise<AiDataHistoryCounts> {
      let total: AiDataHistoryCounts = { chats: 0, diagnoses: 0 };
      for (const days of aiDataRetentionDaysOptions) {
        const before = aiDataRetentionCutoff(now, days);
        total = addCounts(
          total,
          await repository.deleteHistoryBefore({ kind: "chosen", days, before }),
        );
      }
      const before = aiDataRetentionCutoff(now, defaultAiDataRetentionDays);
      return addCounts(total, await repository.deleteHistoryBefore({ kind: "default", before }));
    },

    /** What a diagnosis or chat of `period` would send now, with the saved permissions. */
    async preview(userId: string, period: string): Promise<AiDataPreviewOutput> {
      if (!context) throw new Error("AI data preview needs the financial context reader");
      const scopes = await this.scopesFor(userId);
      const loaded = await context.load(userId, period);
      const described = await context.describe({
        userId,
        period,
        health: calculateFinancialHealth(loaded.healthInput),
        scopes,
        loaded,
      });
      return { period, scopes, data: described.data as Record<string, unknown> };
    },

    /** Scopes in force for a new diagnosis; an absent record shares only aggregates. */
    async scopesFor(userId: string): Promise<AiDataScope[]> {
      return (await this.get(userId)).scopes;
    },
  };
}

export type AiDataSharingService = ReturnType<typeof createAiDataSharingService>;
