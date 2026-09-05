import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  UpdateUserPreferencesInputSchema,
  UserPreferencesOutputSchema,
} from "@openmonetis/validators/preferences";
import type { PreferencesService } from "../services/preferences.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

const successResponse = {
  description: "Current user preferences",
  content: {
    "application/json": {
      schema: z.object({ data: UserPreferencesOutputSchema, error: z.null() }),
    },
  },
} as const;

const unauthorizedResponse = {
  description: "Authentication required",
  content: { "application/json": { schema: errorSchema } },
} as const;

export function createPreferencesRoute(service: PreferencesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/defaults",
      tags: ["Preferences"],
      responses: { 200: successResponse, 401: unauthorizedResponse },
    }),
    (context) => context.json(ok(service.getDefaults()), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Preferences"],
      responses: { 200: successResponse, 401: unauthorizedResponse },
    }),
    async (context) => context.json(ok(await service.get(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/",
      tags: ["Preferences"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: UpdateUserPreferencesInputSchema } },
        },
      },
      responses: {
        200: successResponse,
        400: {
          description: "Invalid or unavailable preference",
          content: { "application/json": { schema: errorSchema } },
        },
        401: unauthorizedResponse,
      },
    }),
    async (context) =>
      context.json(ok(await service.update(context.req.valid("json"), context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/",
      tags: ["Preferences"],
      responses: { 200: successResponse, 401: unauthorizedResponse },
    }),
    async (context) => context.json(ok(await service.reset(context.get("userId"))), 200),
  );

  return route;
}
