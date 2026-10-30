import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { deviceTokenMaximumActiveCount } from "@openmonetis/domain/device-tokens";
import { createDeviceTokensService, type DeviceTokenRepository } from "./device-tokens.service";

const now = new Date("2026-08-10T12:00:00.000Z");
const secret = "a-development-secret-with-at-least-32-characters";
const userId = "00000000-0000-4000-8000-000000000001";

function createRepository(overrides: Partial<DeviceTokenRepository> = {}): DeviceTokenRepository {
  return {
    insertIfBelowActiveLimit: async (data) => ({
      id: "00000000-0000-4000-8000-000000000002",
      ...data,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: now,
    }),
    replaceForUser: async () => null,
    listActiveForUser: async () => [],
    countCapturesSince: async () => new Map(),
    findActiveByDigest: async () => null,
    touchLastUsed: async () => undefined,
    revokeForUser: async () => false,
    ...overrides,
  };
}

test("device token creation stores only a digest and enforces the limit atomically", async () => {
  let receivedTokenDigest = "";
  let receivedMaximum = 0;
  const repository = createRepository({
    insertIfBelowActiveLimit: async (data, _createdAt, maximum) => {
      receivedTokenDigest = data.tokenDigest;
      receivedMaximum = maximum;
      return {
        id: "00000000-0000-4000-8000-000000000002",
        ...data,
        lastUsedAt: null,
        revokedAt: null,
        createdAt: now,
      };
    },
  });
  const service = createDeviceTokensService(repository, { secret, now: () => now });

  const result = await service.create({ name: "  Meu   Android  " }, userId);

  assert.match(result.token, /^opm_[A-Za-z0-9_-]{43}$/);
  assert.equal(result.name, "Meu Android");
  assert.notEqual(receivedTokenDigest, result.token);
  assert.equal(
    receivedTokenDigest,
    createHmac("sha256", secret).update(result.token, "utf8").digest("hex"),
  );
  assert.equal(receivedMaximum, deviceTokenMaximumActiveCount);
});

test("device token creation reports the active-token limit without a count/insert race", async () => {
  const service = createDeviceTokensService(
    createRepository({ insertIfBelowActiveLimit: async () => null }),
    { secret, now: () => now },
  );

  await assert.rejects(service.create({ name: "Android" }, userId), (error: unknown) => {
    return error instanceof Error && "code" in error && error.code === "device_token_limit_reached";
  });
});

test("device token authentication requires the exact format and touches owned credentials", async () => {
  const rawToken = `opm_${"b".repeat(43)}`;
  const expectedDigest = createHmac("sha256", secret).update(rawToken, "utf8").digest("hex");
  let touchedId: string | null = null;
  const service = createDeviceTokensService(
    createRepository({
      findActiveByDigest: async (digest) =>
        digest === expectedDigest
          ? {
              id: "00000000-0000-4000-8000-000000000002",
              userId,
              name: "Android",
              tokenDigest: digest,
              tokenPrefix: rawToken.slice(0, 12),
              lastUsedAt: null,
              expiresAt: new Date("2027-01-01T00:00:00.000Z"),
              revokedAt: null,
              createdAt: now,
            }
          : null,
      touchLastUsed: async (id) => {
        touchedId = id;
      },
    }),
    { secret, now: () => now },
  );

  assert.equal(await service.authenticate("not-a-token"), null);
  const principal = await service.authenticate(rawToken);
  assert.equal(principal?.userId, userId);
  assert.equal(touchedId, "00000000-0000-4000-8000-000000000002");
});

const activeRecord = {
  id: "00000000-0000-4000-8000-000000000003",
  userId,
  name: "Android",
  tokenDigest: "digest",
  tokenPrefix: "opm_aaaaaaaa",
  lastUsedAt: now,
  expiresAt: new Date("2026-08-30T12:00:00.000Z"),
  revokedAt: null,
  createdAt: new Date("2025-08-30T12:00:00.000Z"),
};

test("device token listing flags expiring tokens and counts recent captures per device", async () => {
  let countedSince: Date | null = null;
  const service = createDeviceTokensService(
    createRepository({
      listActiveForUser: async () => [
        activeRecord,
        {
          ...activeRecord,
          id: "00000000-0000-4000-8000-000000000004",
          expiresAt: new Date("2027-01-01T00:00:00.000Z"),
        },
      ],
      countCapturesSince: async (_userId, since) => {
        countedSince = since;
        return new Map([[activeRecord.id, 4]]);
      },
    }),
    { secret, now: () => now },
  );

  const [expiring, healthy] = await service.list(userId);

  assert.equal(expiring.expiresSoon, true);
  assert.equal(expiring.recentCaptureCount, 4);
  assert.equal(healthy.expiresSoon, false);
  assert.equal(healthy.recentCaptureCount, 0);
  assert.deepEqual(countedSince, new Date("2026-08-03T12:00:00.000Z"));
});

test("device token rotation keeps the name and replaces only an owned active token", async () => {
  let replacedId: string | null = null;
  const service = createDeviceTokensService(
    createRepository({
      listActiveForUser: async (owner) => (owner === userId ? [activeRecord] : []),
      replaceForUser: async (id, data) => {
        replacedId = id;
        return {
          id: "00000000-0000-4000-8000-000000000005",
          ...data,
          lastUsedAt: null,
          revokedAt: null,
          createdAt: now,
        };
      },
    }),
    { secret, now: () => now },
  );

  const rotated = await service.rotate(activeRecord.id, userId);

  assert.equal(replacedId, activeRecord.id);
  assert.equal(rotated.name, "Android");
  assert.match(rotated.token, /^opm_[A-Za-z0-9_-]{43}$/);
  assert.equal(rotated.lastUsedAt, null);
  await assert.rejects(
    service.rotate(activeRecord.id, "00000000-0000-4000-8000-000000000009"),
    (error: unknown) =>
      error instanceof Error && "code" in error && error.code === "device_token_not_found",
  );
});
