import {
  backgroundJobCheckpoints,
  db,
  personReportDeliveries,
  personReportSchedules,
  pool,
} from "@openmonetis/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  PersonReportDeliveriesRepository,
  PersonReportSchedulesRepository,
} from "../services/person-reports.service";

const scheduleJobName = "person-report-emails";
const scheduleLockName = "openmonetis:person-report-emails";

const deliveryColumns = {
  id: personReportDeliveries.id,
  userId: personReportDeliveries.userId,
  personId: personReportDeliveries.personId,
  period: personReportDeliveries.period,
  trigger: personReportDeliveries.trigger,
  status: personReportDeliveries.status,
  recipientEmail: personReportDeliveries.recipientEmail,
  includesSpreadsheet: personReportDeliveries.includesSpreadsheet,
  attempts: personReportDeliveries.attempts,
  providerMessageId: personReportDeliveries.providerMessageId,
  errorCode: personReportDeliveries.errorCode,
  scheduledFor: personReportDeliveries.scheduledFor,
  createdAt: personReportDeliveries.createdAt,
  sentAt: personReportDeliveries.sentAt,
  updatedAt: personReportDeliveries.updatedAt,
};

const scheduleColumns = {
  userId: personReportSchedules.userId,
  personId: personReportSchedules.personId,
  enabled: personReportSchedules.enabled,
  frequency: personReportSchedules.frequency,
  weekday: personReportSchedules.weekday,
  monthDays: personReportSchedules.monthDays,
  reportPeriod: personReportSchedules.reportPeriod,
  includeSpreadsheet: personReportSchedules.includeSpreadsheet,
  updatedAt: personReportSchedules.updatedAt,
};

export const personReportsRepository: PersonReportDeliveriesRepository = {
  async insertDelivery(data) {
    const [delivery] = await db
      .insert(personReportDeliveries)
      .values(data)
      .returning(deliveryColumns);
    if (!delivery) throw new Error("Person report delivery was not created");
    return delivery;
  },

  async updateDeliveryForUser(id, userId, data) {
    const [delivery] = await db
      .update(personReportDeliveries)
      .set(data)
      .where(and(eq(personReportDeliveries.id, id), eq(personReportDeliveries.userId, userId)))
      .returning(deliveryColumns);
    return delivery ?? null;
  },

  async listDeliveriesForPerson(personId, userId, limit) {
    return db
      .select(deliveryColumns)
      .from(personReportDeliveries)
      .where(
        and(
          eq(personReportDeliveries.personId, personId),
          eq(personReportDeliveries.userId, userId),
        ),
      )
      .orderBy(desc(personReportDeliveries.createdAt))
      .limit(limit);
  },

  async findScheduledDelivery(personId, userId, scheduledFor) {
    const [delivery] = await db
      .select(deliveryColumns)
      .from(personReportDeliveries)
      .where(
        and(
          eq(personReportDeliveries.personId, personId),
          eq(personReportDeliveries.userId, userId),
          eq(personReportDeliveries.scheduledFor, scheduledFor),
        ),
      )
      .limit(1);
    return delivery ?? null;
  },
};

export const personReportSchedulesRepository: PersonReportSchedulesRepository = {
  async findScheduleForPerson(personId, userId) {
    const [schedule] = await db
      .select(scheduleColumns)
      .from(personReportSchedules)
      .where(
        and(eq(personReportSchedules.personId, personId), eq(personReportSchedules.userId, userId)),
      )
      .limit(1);
    return schedule ?? null;
  },

  async upsertSchedule(data) {
    const { userId, personId, ...settings } = data;
    const [schedule] = await db
      .insert(personReportSchedules)
      .values(data)
      .onConflictDoUpdate({
        target: personReportSchedules.personId,
        set: { ...settings, updatedAt: new Date() },
        // The person id is unique, but the update still requires the same owner.
        setWhere: eq(personReportSchedules.userId, userId),
      })
      .returning(scheduleColumns);
    if (!schedule || schedule.personId !== personId) {
      throw new Error("Person report schedule was not saved");
    }
    return schedule;
  },

  async listEnabledSchedules() {
    return db
      .select(scheduleColumns)
      .from(personReportSchedules)
      .where(eq(personReportSchedules.enabled, true));
  },

  async findLastCompletedRunDate() {
    const [checkpoint] = await db
      .select({ lastCompletedDate: backgroundJobCheckpoints.lastCompletedDate })
      .from(backgroundJobCheckpoints)
      .where(eq(backgroundJobCheckpoints.jobName, scheduleJobName))
      .limit(1);
    return checkpoint?.lastCompletedDate?.toISOString().slice(0, 10) ?? null;
  },

  async markRunCompleted(date, completedAt) {
    const lastCompletedDate = new Date(`${date}T00:00:00.000Z`);
    await db
      .insert(backgroundJobCheckpoints)
      .values({ jobName: scheduleJobName, lastCompletedDate, updatedAt: completedAt })
      .onConflictDoUpdate({
        target: backgroundJobCheckpoints.jobName,
        set: { lastCompletedDate, updatedAt: completedAt },
      });
  },
};

/**
 * Runs the task only if no other API instance is running the scheduled deliveries, using a
 * session advisory lock. Returns null when another instance holds it.
 */
export async function runPersonReportScheduleExclusively<T>(task: () => Promise<T>) {
  const client = await pool.connect();
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as acquired",
      [scheduleLockName],
    );
    if (lock.rows[0]?.acquired !== true) return null;
    try {
      return await task();
    } finally {
      await client
        .query("select pg_advisory_unlock(hashtext($1))", [scheduleLockName])
        .catch(() => undefined);
    }
  } finally {
    client.release();
  }
}
