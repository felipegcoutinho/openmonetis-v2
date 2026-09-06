import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import { resolveDatabaseUrl } from "./database-url";
import * as schema from "./schema";

function positiveIntegerFromEnv(name: string, fallback: number) {
  const rawValue = process.env[name];
  if (!rawValue) return fallback;

  const value = Number(rawValue);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

export const pool = new Pool({
  connectionString: resolveDatabaseUrl(),
  application_name: "openmonetis-api",
  max: positiveIntegerFromEnv("DB_POOL_MAX", 10),
  connectionTimeoutMillis: positiveIntegerFromEnv("DB_CONNECTION_TIMEOUT_MS", 5_000),
  idleTimeoutMillis: positiveIntegerFromEnv("DB_IDLE_TIMEOUT_MS", 30_000),
  statement_timeout: positiveIntegerFromEnv("DB_STATEMENT_TIMEOUT_MS", 15_000),
});

export const db = drizzle(pool, { schema });
export type DatabasePoolClient = PoolClient;
