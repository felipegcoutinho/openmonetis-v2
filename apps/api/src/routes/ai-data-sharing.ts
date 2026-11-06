import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AiDataHistoryDeletedOutputSchema,
  AiDataPreviewOutputSchema,
  AiDataPreviewQuerySchema,
  AiDataSharingOutputSchema,
  UpdateAiDataRetentionInputSchema,
  UpdateAiDataSharingInputSchema,
} from "@openmonetis/validators/ai-data-sharing";
import type { AiDataSharingService } from "../services/ai-data-sharing.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const ResponseSchema = z.object({ data: AiDataSharingOutputSchema, error: z.null() });
const PreviewSchema = z.object({ data: AiDataPreviewOutputSchema, error: z.null() });
const HistoryDeletedSchema = z.object({ data: AiDataHistoryDeletedOutputSchema, error: z.null() });
const unauthorized = {
  description: "Authentication required",
  content: { "application/json": { schema: ErrorSchema } },
} as const;

export function createAiDataSharingRoute(service: AiDataSharingService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["AI data sharing"],
      responses: {
        200: {
          description: "Data the AI diagnosis may send beyond aggregates",
          content: { "application/json": { schema: ResponseSchema } },
        },
        401: unauthorized,
      },
    }),
    async (context) => context.json(ok(await service.get(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/",
      tags: ["AI data sharing"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: UpdateAiDataSharingInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Saved permissions",
          content: { "application/json": { schema: ResponseSchema } },
        },
        400: {
          description: "Invalid permissions",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: unauthorized,
      },
    }),
    async (context) =>
      context.json(ok(await service.update(context.get("userId"), context.req.valid("json"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/preview",
      tags: ["AI data sharing"],
      request: { query: AiDataPreviewQuerySchema },
      responses: {
        200: {
          description: "The financial data an AI diagnosis or chat of the period would send",
          content: { "application/json": { schema: PreviewSchema } },
        },
        400: {
          description: "Invalid period",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: unauthorized,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.preview(context.get("userId"), context.req.valid("query").period)),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/retention",
      tags: ["AI data sharing"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: UpdateAiDataRetentionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Saved retention of AI chats and diagnoses",
          content: { "application/json": { schema: ResponseSchema } },
        },
        400: {
          description: "Invalid retention",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: unauthorized,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.updateRetention(context.get("userId"), context.req.valid("json"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/history",
      tags: ["AI data sharing"],
      responses: {
        200: {
          description: "Every AI chat and diagnosis of the user was deleted",
          content: { "application/json": { schema: HistoryDeletedSchema } },
        },
        401: unauthorized,
      },
    }),
    async (context) => context.json(ok(await service.deleteHistory(context.get("userId"))), 200),
  );

  return route;
}
