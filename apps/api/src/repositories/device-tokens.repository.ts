import { db, deviceTokens } from "@openmonetis/db";
import { and, count, desc, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import type { DeviceTokenRepository } from "../services/device-tokens.service";

export const deviceTokensRepository: DeviceTokenRepository = {
  async insertIfBelowActiveLimit(data, now, maximumActiveCount) {
    return db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:device-token-limit`}, 0))`,
      );
      const [row] = await transaction
        .select({ value: count() })
        .from(deviceTokens)
        .where(
          and(
            eq(deviceTokens.userId, data.userId),
            isNull(deviceTokens.revokedAt),
            gt(deviceTokens.expiresAt, now),
          ),
        );

      if (Number(row.value) >= maximumActiveCount) return null;

      const [record] = await transaction.insert(deviceTokens).values(data).returning();
      return record ?? null;
    });
  },

  async listActiveForUser(userId, now) {
    return db
      .select()
      .from(deviceTokens)
      .where(
        and(
          eq(deviceTokens.userId, userId),
          isNull(deviceTokens.revokedAt),
          gt(deviceTokens.expiresAt, now),
        ),
      )
      .orderBy(desc(deviceTokens.createdAt));
  },

  async findActiveByDigest(tokenDigest, now) {
    const [record] = await db
      .select()
      .from(deviceTokens)
      .where(
        and(
          eq(deviceTokens.tokenDigest, tokenDigest),
          isNull(deviceTokens.revokedAt),
          gt(deviceTokens.expiresAt, now),
        ),
      )
      .limit(1);
    return record ?? null;
  },

  async touchLastUsed(id, usedAt) {
    const fiveMinutesAgo = new Date(usedAt.getTime() - 5 * 60 * 1_000);
    await db
      .update(deviceTokens)
      .set({ lastUsedAt: usedAt, updatedAt: usedAt })
      .where(
        and(
          eq(deviceTokens.id, id),
          or(isNull(deviceTokens.lastUsedAt), lt(deviceTokens.lastUsedAt, fiveMinutesAgo)),
        ),
      );
  },

  async revokeForUser(id, userId, revokedAt) {
    const [record] = await db
      .update(deviceTokens)
      .set({ revokedAt, updatedAt: revokedAt })
      .where(
        and(
          eq(deviceTokens.id, id),
          eq(deviceTokens.userId, userId),
          isNull(deviceTokens.revokedAt),
        ),
      )
      .returning({ id: deviceTokens.id });
    return Boolean(record);
  },
};
