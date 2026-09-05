import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CompanionDeviceAuthenticationErrorSchema,
  CompanionDeviceVerificationOutputSchema,
  CreateDeviceTokenInputSchema,
  CreatedDeviceTokenOutputSchema,
  DeviceTokenOutputSchema,
  DeviceTokenParamsSchema,
} from "@openmonetis/validators/device-tokens";
import type { DeviceTokensService } from "../services/device-tokens.service";
import type { ApiVariables } from "../types/context";
import {
  companionValidationHook,
  ErrorResponseSchema as errorSchema,
  validationHook,
} from "../utils/openapi";

const errorResponses = {
  400: { description: "Invalid request", content: { "application/json": { schema: errorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: errorSchema } },
  },
  404: { description: "Token not found", content: { "application/json": { schema: errorSchema } } },
} as const;

export function createDeviceTokensRoute(service: DeviceTokensService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Device tokens"],
      responses: {
        200: {
          description: "Active Companion tokens",
          content: {
            "application/json": {
              schema: z.object({ data: z.array(DeviceTokenOutputSchema), error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Device tokens"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateDeviceTokenInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Device token created; the secret is returned only once",
          content: {
            "application/json": {
              schema: z.object({ data: CreatedDeviceTokenOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Device tokens"],
      request: { params: DeviceTokenParamsSchema },
      responses: {
        200: {
          description: "Device token revoked",
          content: {
            "application/json": {
              schema: z.object({ data: z.object({ id: z.uuid() }), error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.revoke(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  return route;
}

export function createCompanionDeviceRoute() {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({
    defaultHook: companionValidationHook,
  });
  route.openapi(
    createRoute({
      method: "post",
      path: "/verify",
      tags: ["Companion compatibility"],
      security: [{ deviceBearer: [] }],
      responses: {
        200: {
          description: "Valid Companion token",
          content: {
            "application/json": {
              schema: CompanionDeviceVerificationOutputSchema,
            },
          },
        },
        401: {
          description: "Invalid Companion token",
          content: {
            "application/json": {
              schema: CompanionDeviceAuthenticationErrorSchema,
            },
          },
        },
        429: {
          description: "Too many verification attempts",
          content: {
            "application/json": { schema: CompanionDeviceAuthenticationErrorSchema },
          },
        },
        500: {
          description: "Internal error",
          content: { "application/json": { schema: z.object({ error: z.string() }) } },
        },
      },
    }),
    (context) =>
      context.json(
        {
          valid: true as const,
          tokenId: context.get("deviceTokenId"),
          tokenName: context.get("deviceTokenName"),
          expiresAt: context.get("deviceTokenExpiresAt").toISOString(),
        },
        200,
      ),
  );
  return route;
}
