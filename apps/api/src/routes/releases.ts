import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  MarkReleaseSeenInputSchema,
  MarkReleaseSeenOutputSchema,
  ReleaseParamsSchema,
  ReleasesOutputSchema,
} from "@openmonetis/validators/releases";
import type { ReleasesService } from "../services/releases.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

export function createReleasesRoute(service: ReleasesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Releases"],
      responses: {
        200: {
          description: "Application version, release history and update status",
          content: {
            "application/json": {
              schema: z.object({ data: ReleasesOutputSchema, error: z.null() }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{version}",
      tags: ["Releases"],
      request: {
        params: ReleaseParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: MarkReleaseSeenInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Current release marked as seen",
          content: {
            "application/json": {
              schema: z.object({ data: MarkReleaseSeenOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid release state",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Release not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.markSeen(
            context.req.valid("param").version,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  return route;
}
