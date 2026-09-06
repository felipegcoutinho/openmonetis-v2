import assert from "node:assert/strict";
import test from "node:test";
import { resolveDatabaseUrl } from "./database-url";

test("builds the local URL from the shared PostgreSQL settings", () => {
  assert.equal(
    resolveDatabaseUrl({
      DB_HOST_PORT: "7009",
      POSTGRES_DB: "money db",
      POSTGRES_PASSWORD: "p@ss",
      POSTGRES_USER: "app",
    }),
    "postgres://app:p%40ss@localhost:7009/money%20db",
  );
});

test("uses one external URL for local processes", () => {
  assert.equal(
    resolveDatabaseUrl({ EXTERNAL_DATABASE_URL: "postgres://external.example/openmonetis" }),
    "postgres://external.example/openmonetis",
  );
});

test("requires the Compose-provided URL in production", () => {
  assert.equal(
    resolveDatabaseUrl({
      DATABASE_URL: "postgres://db:5432/openmonetis",
      NODE_ENV: "production",
    }),
    "postgres://db:5432/openmonetis",
  );
  assert.throws(
    () => resolveDatabaseUrl({ NODE_ENV: "production" }),
    /DATABASE_URL is required in production/,
  );
});
