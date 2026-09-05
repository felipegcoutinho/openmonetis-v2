import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolClient } from "pg";
import * as schema from "./schema";

const LOCAL_DATABASE_URL = "postgres://postgres:postgres@localhost:7000/openmonetis";

function getDatabaseUrl() {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }

  return LOCAL_DATABASE_URL;
}

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
  connectionString: getDatabaseUrl(),
  application_name: "openmonetis-api",
  max: positiveIntegerFromEnv("DB_POOL_MAX", 10),
  connectionTimeoutMillis: positiveIntegerFromEnv("DB_CONNECTION_TIMEOUT_MS", 5_000),
  idleTimeoutMillis: positiveIntegerFromEnv("DB_IDLE_TIMEOUT_MS", 30_000),
  statement_timeout: positiveIntegerFromEnv("DB_STATEMENT_TIMEOUT_MS", 15_000),
});

export const db = drizzle(pool, { schema });
export type DatabasePoolClient = PoolClient;
