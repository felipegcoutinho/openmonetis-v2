#!/usr/bin/env tsx

/**
 * Recreates the shared local test user: deletes it with everything it owns, signs it up again
 * through Better Auth (so it gets the admin person and default categories like any account) and
 * fills six months, up to the current one, with the demo data seed.
 *
 * Only for local development: it refuses to run in production or against a database that is not
 * on this machine.
 */

import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { resolveDatabaseUrl } from "@openmonetis/db/database-url";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";

export const testUser = {
  name: "Pumita Rodriguez",
  email: "teste@openmonetis.local",
  password: "openmonetis-teste",
} as const;

/** Months of demo data, ending in the current month. */
export const testUserSeedMonths = 6;

/** Avatar from the app catalog, so the test user never carries a personal photo. */
export const testUserAvatar = "/avatars/4825015.png";

const localDatabaseHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isLocalDatabaseUrl(databaseUrl: string | undefined) {
  if (!databaseUrl) return false;
  try {
    return localDatabaseHosts.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

export function assertLocalDevelopment(environment: NodeJS.ProcessEnv) {
  if (environment.NODE_ENV === "production") {
    throw new Error("O usuário de teste não pode ser criado em produção.");
  }
  // The same resolution the database client uses, so the check sees the database it would write to.
  if (!isLocalDatabaseUrl(resolveDatabaseUrl(environment))) {
    throw new Error(
      "O usuário de teste só é criado em um banco local (localhost). Confira EXTERNAL_DATABASE_URL.",
    );
  }
}

export function getTestUserStartPeriod(currentPeriod: string) {
  return addMonthsToPeriod(currentPeriod, -(testUserSeedMonths - 1));
}

async function recreateTestUser() {
  assertLocalDevelopment(process.env);

  // Loaded only after the checks: both connect to the database and read the auth settings.
  const { db, user } = await import("@openmonetis/db");
  const { eq } = await import("drizzle-orm");
  const { auth } = await import("../auth");
  const { seedMockData } = await import("./mock-data");

  // Deleting the user cascades to every row it owns.
  const removed = await db.delete(user).where(eq(user.email, testUser.email)).returning({
    id: user.id,
  });
  await auth.api.signUpEmail({
    body: { name: testUser.name, email: testUser.email, password: testUser.password },
  });
  await seedMockData([
    `--email=${testUser.email}`,
    `--startPeriod=${getTestUserStartPeriod(getCurrentPeriodInBrazil())}`,
    `--months=${testUserSeedMonths}`,
    `--avatar=${testUserAvatar}`,
  ]);

  console.log(
    [
      removed.length ? "Usuário de teste recriado." : "Usuário de teste criado.",
      `E-mail: ${testUser.email}`,
      `Senha: ${testUser.password}`,
      `Avatar: ${testUserAvatar}`,
    ].join("\n"),
  );
}

function isDirectExecution() {
  const executablePath = process.argv[1];
  return Boolean(executablePath && pathToFileURL(resolve(executablePath)).href === import.meta.url);
}

if (isDirectExecution()) {
  void (async () => {
    try {
      await recreateTestUser();
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Erro ao criar o usuário de teste.");
      process.exitCode = 1;
    } finally {
      const { pool } = await import("@openmonetis/db");
      await pool.end();
    }
  })();
}
