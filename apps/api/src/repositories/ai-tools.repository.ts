import { aiToolEvents, db, user } from "@openmonetis/db";
import { and, asc, desc, eq, isNotNull } from "drizzle-orm";
import type { AiToolsRepository } from "../services/ai-tools.service";

/**
 * Tool updates belong to the installation, not to one account's finances, so the history is read
 * for the whole installation; only its admin (checked by the service) ever reaches it.
 */
export const aiToolsRepository: AiToolsRepository = {
  async findInstallationAdminId() {
    const [first] = await db
      .select({ id: user.id })
      .from(user)
      .orderBy(asc(user.createdAt), asc(user.id))
      .limit(1);
    return first?.id ?? null;
  },

  async insertEvent(userId, event, completedAt) {
    await db.insert(aiToolEvents).values({ ...event, userId, completedAt });
  },

  async completeEvent(jobId, status, failureCode, completedAt) {
    await db
      .update(aiToolEvents)
      .set({ status, failureCode, completedAt, jobId: null })
      .where(eq(aiToolEvents.jobId, jobId));
  },

  async listPendingJobIds() {
    const rows = await db
      .select({ jobId: aiToolEvents.jobId })
      .from(aiToolEvents)
      .where(and(eq(aiToolEvents.status, "pending"), isNotNull(aiToolEvents.jobId)));
    return rows.flatMap((row) => (row.jobId ? [row.jobId] : []));
  },

  async listEvents() {
    return db
      .select({
        id: aiToolEvents.id,
        provider: aiToolEvents.provider,
        action: aiToolEvents.action,
        fromVersion: aiToolEvents.fromVersion,
        toVersion: aiToolEvents.toVersion,
        status: aiToolEvents.status,
        failureCode: aiToolEvents.failureCode,
        jobId: aiToolEvents.jobId,
        createdAt: aiToolEvents.createdAt,
      })
      .from(aiToolEvents)
      .orderBy(desc(aiToolEvents.createdAt), desc(aiToolEvents.id));
  },
};
