import { createMiddleware } from "hono/factory";
import type { DeviceTokensService } from "../services/device-tokens.service";
import type { ApiVariables } from "../types/context";

export function createRequireDeviceToken(service: Pick<DeviceTokensService, "authenticate">) {
  return createMiddleware<{ Variables: ApiVariables }>(async (context, next) => {
    const principal = await service.authenticate(
      extractBearerToken(context.req.header("Authorization")),
    );

    if (!principal) {
      return context.json({ valid: false, error: "Token inválido ou expirado" }, 401);
    }

    context.set("userId", principal.userId);
    context.set("deviceTokenId", principal.tokenId);
    context.set("deviceTokenName", principal.tokenName);
    context.set("deviceTokenExpiresAt", principal.expiresAt);
    await next();
  });
}

function extractBearerToken(value: string | undefined) {
  if (!value || value.length > 256) return null;
  return /^Bearer ([^\s]+)$/i.exec(value)?.[1] ?? null;
}
