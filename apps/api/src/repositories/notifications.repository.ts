import { db, notificationStates } from "@openmonetis/db";
import { and, eq, inArray } from "drizzle-orm";
import type { NotificationsRepository } from "../services/notifications.service";

export const notificationsRepository: NotificationsRepository = {
  async listForKeys(userId, notificationKeys) {
    if (notificationKeys.length === 0) return [];

    const rows = await db
      .select({
        notificationKey: notificationStates.notificationKey,
        fingerprint: notificationStates.fingerprint,
        readAt: notificationStates.readAt,
        archivedAt: notificationStates.archivedAt,
      })
      .from(notificationStates)
      .where(
        and(
          eq(notificationStates.userId, userId),
          inArray(notificationStates.notificationKey, notificationKeys),
        ),
      );

    return rows.map((row) => ({
      ...row,
      readAt: row.readAt?.toISOString() ?? null,
      archivedAt: row.archivedAt?.toISOString() ?? null,
    }));
  },

  async save(userId, state) {
    await db
      .insert(notificationStates)
      .values({
        userId,
        notificationKey: state.notificationKey,
        fingerprint: state.fingerprint,
        readAt: state.readAt ? new Date(state.readAt) : null,
        archivedAt: state.archivedAt ? new Date(state.archivedAt) : null,
      })
      .onConflictDoUpdate({
        target: [notificationStates.userId, notificationStates.notificationKey],
        set: {
          fingerprint: state.fingerprint,
          readAt: state.readAt ? new Date(state.readAt) : null,
          archivedAt: state.archivedAt ? new Date(state.archivedAt) : null,
          updatedAt: new Date(),
        },
      });
  },
};
