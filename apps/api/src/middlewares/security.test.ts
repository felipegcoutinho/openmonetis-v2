import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createMutationRateLimit } from "./security";

test("rate limiting supports compatibility responses and Retry-After", async () => {
  const app = new Hono();
  app.use(
    "*",
    createMutationRateLimit({
      windowMs: 60_000,
      max: 1,
      key: (context) => context.req.header("x-test-key") ?? "anonymous",
      onLimit: (context) => context.json({ error: "Muitas solicitações" }, 429),
    }),
  );
  app.post("/", (context) => context.json({ accepted: true }));

  const first = await app.request("/", { method: "POST", headers: { "x-test-key": "device" } });
  const limited = await app.request("/", {
    method: "POST",
    headers: { "x-test-key": "device" },
  });

  assert.equal(first.status, 200);
  assert.equal(limited.status, 429);
  assert.deepEqual(await limited.json(), { error: "Muitas solicitações" });
  assert.match(limited.headers.get("Retry-After") ?? "", /^\d+$/);
});

test("rate limiting evicts entries when its memory cap is reached", async () => {
  const app = new Hono();
  app.use(
    "*",
    createMutationRateLimit({
      windowMs: 60_000,
      max: 1,
      maxEntries: 2,
      key: (context) => context.req.header("x-test-key") ?? "anonymous",
    }),
  );
  app.post("/", (context) => context.json({ accepted: true }));

  for (const key of ["first", "second", "third"]) {
    assert.equal(
      (await app.request("/", { method: "POST", headers: { "x-test-key": key } })).status,
      200,
    );
  }

  assert.equal(
    (await app.request("/", { method: "POST", headers: { "x-test-key": "first" } })).status,
    200,
  );
});

test("rate limiting isolates authenticated identities", async () => {
  const app = new Hono();
  app.use(
    "*",
    createMutationRateLimit({
      windowMs: 60_000,
      max: 1,
      key: (context) => context.req.header("x-user-id") ?? null,
    }),
  );
  app.post("/", (context) => context.json({ accepted: true }));

  assert.equal(
    (await app.request("/", { method: "POST", headers: { "x-user-id": "user-a" } })).status,
    200,
  );
  assert.equal(
    (await app.request("/", { method: "POST", headers: { "x-user-id": "user-a" } })).status,
    429,
  );
  assert.equal(
    (await app.request("/", { method: "POST", headers: { "x-user-id": "user-b" } })).status,
    200,
  );
});

test("rate limiting skips requests without a trusted identity", async () => {
  const app = new Hono();
  app.use(
    "*",
    createMutationRateLimit({
      windowMs: 60_000,
      max: 1,
      key: () => null,
    }),
  );
  app.post("/", (context) => context.json({ accepted: true }));

  assert.equal((await app.request("/", { method: "POST" })).status, 200);
  assert.equal((await app.request("/", { method: "POST" })).status, 200);
});
