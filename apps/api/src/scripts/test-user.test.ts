import assert from "node:assert/strict";
import { test } from "node:test";
import { assertLocalDevelopment, getTestUserStartPeriod, isLocalDatabaseUrl } from "./test-user";

test("the test user is only created against a database on this machine", () => {
  assert.equal(isLocalDatabaseUrl("postgres://user:pass@localhost:7000/openmonetis"), true);
  assert.equal(isLocalDatabaseUrl("postgres://user:pass@127.0.0.1:7000/openmonetis"), true);
  assert.equal(isLocalDatabaseUrl("postgres://user:pass@db:5432/openmonetis"), false);
  assert.equal(isLocalDatabaseUrl("postgres://user:pass@db.example.com/openmonetis"), false);
  assert.equal(isLocalDatabaseUrl(undefined), false);
  assert.equal(isLocalDatabaseUrl("not a url"), false);
});

test("the test user is never created in production or in an external database", () => {
  // Outside production the database client builds a localhost URL from the POSTGRES_* settings.
  assert.doesNotThrow(() => assertLocalDevelopment({ NODE_ENV: "development" }));
  assert.throws(() =>
    assertLocalDevelopment({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://user:pass@localhost:7000/openmonetis",
    }),
  );
  assert.throws(() =>
    assertLocalDevelopment({
      EXTERNAL_DATABASE_URL: "postgres://user:pass@db.example.com:5432/openmonetis",
    }),
  );
});

test("the test user's demo data ends in the current month", () => {
  assert.equal(getTestUserStartPeriod("2026-11"), "2026-06");
  assert.equal(getTestUserStartPeriod("2026-03"), "2025-10");
});
