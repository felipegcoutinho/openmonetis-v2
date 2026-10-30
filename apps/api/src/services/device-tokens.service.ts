import { createHmac, randomBytes } from "node:crypto";
import {
  deviceTokenMaximumActiveCount,
  deviceTokenPrefix,
  getDeviceTokenActivityStart,
  getDeviceTokenExpiration,
  hasDeviceTokenFormat,
  isDeviceTokenExpiringSoon,
  normalizeDeviceTokenName,
} from "@openmonetis/domain/device-tokens";
import type {
  CreateDeviceTokenInput,
  CreatedDeviceTokenOutput,
  DeviceTokenOutput,
} from "@openmonetis/validators/device-tokens";
import { conflict, notFound } from "../utils/errors";

type DeviceTokenRecord = {
  id: string;
  userId: string;
  name: string;
  tokenDigest: string;
  tokenPrefix: string;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
};

type NewDeviceTokenData = {
  userId: string;
  name: string;
  tokenDigest: string;
  tokenPrefix: string;
  expiresAt: Date;
};

export type DeviceTokenRepository = {
  insertIfBelowActiveLimit(
    data: NewDeviceTokenData,
    now: Date,
    maximumActiveCount: number,
  ): Promise<DeviceTokenRecord | null>;
  /** Revokes an active owned token and inserts its replacement atomically. */
  replaceForUser(
    id: string,
    data: NewDeviceTokenData,
    now: Date,
  ): Promise<DeviceTokenRecord | null>;
  listActiveForUser(userId: string, now: Date): Promise<DeviceTokenRecord[]>;
  countCapturesSince(userId: string, since: Date): Promise<Map<string, number>>;
  findActiveByDigest(tokenDigest: string, now: Date): Promise<DeviceTokenRecord | null>;
  touchLastUsed(id: string, usedAt: Date): Promise<void>;
  revokeForUser(id: string, userId: string, revokedAt: Date): Promise<boolean>;
};

type DeviceTokenPrincipal = {
  tokenId: string;
  tokenName: string;
  userId: string;
  expiresAt: Date;
};

export function createDeviceTokensService(
  repository: DeviceTokenRepository,
  options: { secret: string; now?: () => Date } = { secret: "" },
) {
  if (options.secret.length < 32) {
    throw new Error("DEVICE_TOKEN_SECRET must contain at least 32 characters");
  }

  const now = options.now ?? (() => new Date());
  const digest = (token: string) =>
    createHmac("sha256", options.secret).update(token, "utf8").digest("hex");

  function issueToken(userId: string, name: string, createdAt: Date) {
    const token = `${deviceTokenPrefix}${randomBytes(32).toString("base64url")}`;
    const data: NewDeviceTokenData = {
      userId,
      name: normalizeDeviceTokenName(name),
      tokenDigest: digest(token),
      tokenPrefix: token.slice(0, 12),
      expiresAt: getDeviceTokenExpiration(createdAt),
    };
    return { token, data };
  }

  return {
    async create(input: CreateDeviceTokenInput, userId: string): Promise<CreatedDeviceTokenOutput> {
      const createdAt = now();
      const { token, data } = issueToken(userId, input.name, createdAt);
      const record = await repository.insertIfBelowActiveLimit(
        data,
        createdAt,
        deviceTokenMaximumActiveCount,
      );

      if (!record) {
        throw conflict(
          "Revoke an existing device token before creating another",
          "device_token_limit_reached",
        );
      }

      return { ...toOutput(record, createdAt, 0), token };
    },

    async rotate(id: string, userId: string): Promise<CreatedDeviceTokenOutput> {
      const createdAt = now();
      const current = (await repository.listActiveForUser(userId, createdAt)).find(
        (record) => record.id === id,
      );
      if (!current) throw notFound("Device token not found", "device_token_not_found");

      const { token, data } = issueToken(userId, current.name, createdAt);
      const record = await repository.replaceForUser(id, data, createdAt);
      if (!record) throw notFound("Device token not found", "device_token_not_found");
      return { ...toOutput(record, createdAt, 0), token };
    },

    async list(userId: string): Promise<DeviceTokenOutput[]> {
      const listedAt = now();
      const [records, captureCounts] = await Promise.all([
        repository.listActiveForUser(userId, listedAt),
        repository.countCapturesSince(userId, getDeviceTokenActivityStart(listedAt)),
      ]);
      return records.map((record) => toOutput(record, listedAt, captureCounts.get(record.id) ?? 0));
    },

    async revoke(id: string, userId: string) {
      const revoked = await repository.revokeForUser(id, userId, now());
      if (!revoked) throw notFound("Device token not found", "device_token_not_found");
      return { id };
    },

    async authenticate(rawToken: string | null): Promise<DeviceTokenPrincipal | null> {
      if (!rawToken || !hasDeviceTokenFormat(rawToken)) return null;

      const usedAt = now();
      const record = await repository.findActiveByDigest(digest(rawToken), usedAt);
      if (!record) return null;

      await repository.touchLastUsed(record.id, usedAt);
      return {
        tokenId: record.id,
        tokenName: record.name,
        userId: record.userId,
        expiresAt: record.expiresAt,
      };
    },
  };
}

function toOutput(
  record: DeviceTokenRecord,
  now: Date,
  recentCaptureCount: number,
): DeviceTokenOutput {
  return {
    id: record.id,
    name: record.name,
    tokenPrefix: record.tokenPrefix,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt.toISOString(),
    expiresSoon: isDeviceTokenExpiringSoon(record.expiresAt, now),
    recentCaptureCount,
    createdAt: record.createdAt.toISOString(),
  };
}

export type DeviceTokensService = ReturnType<typeof createDeviceTokensService>;
