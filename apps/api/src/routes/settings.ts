import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  DeleteSettingsAccountInputSchema,
  DeleteSettingsAccountOutputSchema,
  ResetSettingsInputSchema,
  ResetSettingsOutputSchema,
  SettingsSecurityOutputSchema,
} from "@openmonetis/validators/settings";
import type { SettingsService } from "../services/settings.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const errorResponses = {
  400: {
    description: "Invalid confirmation",
    content: { "application/json": { schema: ErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "User not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  429: {
    description: "Too many requests",
    content: { "application/json": { schema: ErrorSchema } },
  },
  503: {
    description: "Attachment storage unavailable",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createSettingsRoute(service: SettingsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/security",
      tags: ["Settings"],
      responses: {
        200: {
          description: "Security settings",
          content: {
            "application/json": {
              schema: z.object({ data: SettingsSecurityOutputSchema, error: z.null() }),
            },
          },
        },
        401: errorResponses[401],
      },
    }),
    async (context) => context.json(ok(await service.getSecurity(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/reset",
      tags: ["Settings"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: ResetSettingsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Application data reset",
          content: {
            "application/json": {
              schema: z.object({ data: ResetSettingsOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(ok(await service.reset(context.req.valid("json"), context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/account",
      tags: ["Settings"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: DeleteSettingsAccountInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Account deleted",
          content: {
            "application/json": {
              schema: z.object({ data: DeleteSettingsAccountOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.deleteAccount(context.req.valid("json"), context.get("userId"))),
        200,
      ),
  );

  return route;
}
