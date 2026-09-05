import { createHmac, randomBytes } from "node:crypto";
import {
  deviceTokenMaximumActiveCount,
  deviceTokenPrefix,
  getDeviceTokenExpiration,
  hasDeviceTokenFormat,
  normalizeDeviceTokenName,
} from "@openmonetis/domain/device-tokens";
import type {
  CreateDeviceTokenInput,
  CreatedDeviceTokenOutput,
  DeviceTokenOutput,
} from "@openmonetis/validators/device-tokens";
import { conflict, notFound } from "../utils/errors";

export type DeviceTokenRecord = {
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

export type DeviceTokenRepository = {
  insertIfBelowActiveLimit(
    data: {
      userId: string;
      name: string;
      tokenDigest: string;
      tokenPrefix: string;
      expiresAt: Date;
    },
    now: Date,
    maximumActiveCount: number,
  ): Promise<DeviceTokenRecord | null>;
  listActiveForUser(userId: string, now: Date): Promise<DeviceTokenRecord[]>;
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

  return {
    async create(input: CreateDeviceTokenInput, userId: string): Promise<CreatedDeviceTokenOutput> {
      const createdAt = now();
      const token = `${deviceTokenPrefix}${randomBytes(32).toString("base64url")}`;
      const record = await repository.insertIfBelowActiveLimit(
        {
          userId,
          name: normalizeDeviceTokenName(input.name),
          tokenDigest: digest(token),
          tokenPrefix: token.slice(0, 12),
          expiresAt: getDeviceTokenExpiration(createdAt),
        },
        createdAt,
        deviceTokenMaximumActiveCount,
      );

      if (!record) {
        throw conflict(
          "Revoke an existing device token before creating another",
          "device_token_limit_reached",
        );
      }

      return { ...toOutput(record), token };
    },

    async list(userId: string): Promise<DeviceTokenOutput[]> {
      const records = await repository.listActiveForUser(userId, now());
      return records.map(toOutput);
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

function toOutput(record: DeviceTokenRecord): DeviceTokenOutput {
  return {
    id: record.id,
    name: record.name,
    tokenPrefix: record.tokenPrefix,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    expiresAt: record.expiresAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export type DeviceTokensService = ReturnType<typeof createDeviceTokensService>;
