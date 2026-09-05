import assert from "node:assert/strict";
import test from "node:test";
import { OpenAPIHono } from "@hono/zod-openapi";
import { createRequireDeviceToken } from "../middlewares/device-auth";
import { errorHandler, notFoundHandler } from "../middlewares/errors";
import type { InboxService } from "../services/inbox.service";
import type { ApiVariables } from "../types/context";
import { createCompanionDeviceRoute } from "./device-tokens";
import { createCompanionInboxRoute } from "./inbox";

const tokenId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const inboxId = "00000000-0000-4000-8000-000000000003";
const validToken = `opm_${"a".repeat(43)}`;

function createTestApp(service: Pick<InboxService, "ingest" | "ingestBatch">) {
  const app = new OpenAPIHono<{ Variables: ApiVariables }>();
  app.onError(errorHandler);
  app.notFound(notFoundHandler);
  app.use(
    "/api/*",
    createRequireDeviceToken({
      authenticate: async (token) =>
        token === validToken
          ? {
              tokenId,
              tokenName: "Android",
              userId,
              expiresAt: new Date("2027-01-01T00:00:00.000Z"),
            }
          : null,
    }),
  );
  app.route("/api/auth/device", createCompanionDeviceRoute());
  app.route("/api/inbox", createCompanionInboxRoute(service));
  return app;
}

const acceptedService: Pick<InboxService, "ingest" | "ingestBatch"> = {
  ingest: async (input) => ({ id: inboxId, clientId: input.clientId ?? null, duplicate: false }),
  ingestBatch: async (inputs) =>
    inputs.map((input) => ({
      clientId: input.clientId ?? null,
      serverId: inboxId,
      success: true,
      error: null,
    })),
};

test("Companion authentication keeps the documented unwrapped response", async () => {
  const app = createTestApp(acceptedService);

  const invalid = await app.request("/api/auth/device/verify", { method: "POST" });
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { valid: false, error: "Token inválido ou expirado" });

  const valid = await app.request("/api/auth/device/verify", {
    method: "POST",
    headers: { Authorization: `Bearer ${validToken}` },
  });
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), {
    valid: true,
    tokenId,
    tokenName: "Android",
    expiresAt: "2027-01-01T00:00:00.000Z",
  });
});

test("Companion ingestion validates the whole request and keeps compatibility errors", async () => {
  const app = createTestApp(acceptedService);
  const headers = {
    Authorization: `Bearer ${validToken}`,
    "Content-Type": "application/json",
  };

  const accepted = await app.request("/api/inbox", {
    method: "POST",
    headers,
    body: JSON.stringify({
      sourceApp: "com.example.bank",
      originalText: "Compra aprovada",
      notificationTimestamp: new Date().toISOString(),
      clientId: "notification-1",
    }),
  });
  assert.equal(accepted.status, 201);
  assert.deepEqual(await accepted.json(), {
    id: inboxId,
    clientId: "notification-1",
    message: "Notificação recebida",
  });

  const invalidBatch = await app.request("/api/inbox/batch", {
    method: "POST",
    headers,
    body: JSON.stringify({ items: [{ sourceApp: "invalid package", originalText: "Compra" }] }),
  });
  assert.equal(invalidBatch.status, 400);
  assert.deepEqual(await invalidBatch.json(), { error: "Revise os dados enviados" });
});

test("Companion internal errors never expose database error codes", async () => {
  const app = createTestApp({
    ...acceptedService,
    ingest: async () => {
      throw Object.assign(new Error("duplicate key value violates unique constraint"), {
        code: "23505",
      });
    },
  });
  const previousConsoleError = console.error;
  console.error = () => undefined;

  try {
    const response = await app.request("/api/inbox", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${validToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sourceApp: "com.example.bank",
        originalText: "Compra aprovada",
        notificationTimestamp: new Date().toISOString(),
      }),
    });

    assert.equal(response.status, 500);
    const body = await response.text();
    assert.deepEqual(JSON.parse(body), { error: "Erro interno" });
    assert.equal(body.includes("23505"), false);
  } finally {
    console.error = previousConsoleError;
  }
});
