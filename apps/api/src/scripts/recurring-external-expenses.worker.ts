#!/usr/bin/env tsx

import { backgroundJobCheckpoints, db, pool } from "@openmonetis/db";
import {
  getCurrentDateInBrazil,
  getCurrentHourInBrazil,
  getCurrentPeriodInBrazil,
} from "@openmonetis/shared/date-time";
import { eq } from "drizzle-orm";
import { externalExpensesRepository } from "../repositories/external-expenses.repository";
import { synchronizeRecurringExternalExpenses } from "../services/external-expenses.service";

const jobName = "recurring-external-expenses";
const lockName = "openmonetis:recurring-external-expenses";
const scheduledHour = 3;
const tickIntervalMs = 60_000;

let stopping = false;

async function runIfDue(now = new Date()) {
  const today = getCurrentDateInBrazil(now);
  if (getCurrentHourInBrazil(now) < scheduledHour) return;
  const [checkpoint] = await db
    .select({ lastCompletedDate: backgroundJobCheckpoints.lastCompletedDate })
    .from(backgroundJobCheckpoints)
    .where(eq(backgroundJobCheckpoints.jobName, jobName))
    .limit(1);
  const lastCompletedDate = checkpoint?.lastCompletedDate?.toISOString().slice(0, 10) ?? null;
  if (lastCompletedDate && lastCompletedDate >= today) return;

  const client = await pool.connect();
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "select pg_try_advisory_lock(hashtext($1)) as acquired",
      [lockName],
    );
    if (lock.rows[0]?.acquired !== true) return;
    const periods = periodsToSynchronize(lastCompletedDate, today);
    const totals = { created: 0, updated: 0, deleted: 0 };
    for (const period of periods) {
      const result = await synchronizeRecurringExternalExpenses(
        externalExpensesRepository,
        { period },
        () => now,
      );
      totals.created += result.created;
      totals.updated += result.updated;
      totals.deleted += result.deleted;
    }
    await db
      .insert(backgroundJobCheckpoints)
      .values({
        jobName,
        lastCompletedDate: new Date(`${today}T00:00:00.000Z`),
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: backgroundJobCheckpoints.jobName,
        set: {
          lastCompletedDate: new Date(`${today}T00:00:00.000Z`),
          updatedAt: now,
        },
      });
    console.log(
      JSON.stringify({
        event: "recurring_external_expenses_synchronized",
        businessDate: today,
        periods,
        ...totals,
      }),
    );
  } finally {
    await client
      .query("select pg_advisory_unlock(hashtext($1))", [lockName])
      .catch(() => undefined);
    client.release();
  }
}

function periodsToSynchronize(lastCompletedDate: string | null, today: string) {
  if (!lastCompletedDate) return [getCurrentPeriodInBrazil(new Date(`${today}T15:00:00.000Z`))];
  const startPeriod = lastCompletedDate.slice(0, 7);
  const endPeriod = today.slice(0, 7);
  const periods: string[] = [];
  for (let period = startPeriod; period <= endPeriod; period = nextPeriod(period)) {
    periods.push(period);
  }
  return periods;
}

function nextPeriod(period: string) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 7);
}

async function main() {
  while (!stopping) {
    await runIfDue().catch((error) => {
      console.error("recurring_external_expense_worker_failed", error);
    });
    await new Promise((resolve) => setTimeout(resolve, tickIntervalMs));
  }
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    stopping = true;
  });
}

await main();
await pool.end();
