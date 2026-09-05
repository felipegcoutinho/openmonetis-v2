import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import { CompanionDeviceAuthenticationErrorSchema } from "@openmonetis/validators/device-tokens";
import {
  CompanionInboxAcceptedOutputSchema,
  CompanionInboxBatchInputSchema,
  CompanionInboxBatchOutputSchema,
  CompanionInboxErrorSchema,
  CompanionInboxItemInputSchema,
  InboxItemOutputSchema,
  InboxItemParamsSchema,
  InboxItemSummaryOutputSchema,
  InboxPageOutputSchema,
  InboxSnapshotOutputSchema,
  InboxSnapshotQuerySchema,
  ListInboxItemsQuerySchema,
  ProcessInboxItemInputSchema,
} from "@openmonetis/validators/inbox";
import {
  TransactionInputSchema,
  TransactionOutputSchema,
} from "@openmonetis/validators/transactions";
import type { InboxService } from "../services/inbox.service";
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
  404: {
    description: "Inbox item not found",
    content: { "application/json": { schema: errorSchema } },
  },
  409: {
    description: "Inbox state conflict",
    content: { "application/json": { schema: errorSchema } },
  },
} as const;

export function createInboxRoute(service: InboxService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Inbox"],
      request: { query: ListInboxItemsQuerySchema },
      responses: {
        200: {
          description: "Paginated inbox items",
          content: {
            "application/json": {
              schema: z.object({ data: InboxPageOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(ok(await service.list(context.req.valid("query"), context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/snapshot",
      tags: ["Inbox"],
      request: { query: InboxSnapshotQuerySchema },
      responses: {
        200: {
          description: "Pending inbox dashboard snapshot",
          content: {
            "application/json": {
              schema: z.object({ data: InboxSnapshotOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.snapshot(context.get("userId"), context.req.valid("query").limit)),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Inbox"],
      request: { params: InboxItemParamsSchema },
      responses: {
        200: {
          description: "Inbox item details including the original notification",
          content: {
            "application/json": {
              schema: z.object({ data: InboxItemOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.get(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  for (const action of ["discard", "restore"] as const) {
    route.openapi(
      createRoute({
        method: "post",
        path: `/{id}/${action}`,
        tags: ["Inbox"],
        request: { params: InboxItemParamsSchema },
        responses: {
          200: {
            description: `${action} inbox item`,
            content: {
              "application/json": {
                schema: z.object({ data: InboxItemSummaryOutputSchema, error: z.null() }),
              },
            },
          },
          ...errorResponses,
        },
      }),
      async (context) =>
        context.json(
          ok(await service[action](context.req.valid("param").id, context.get("userId"))),
          200,
        ),
    );
  }

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/confirm",
      tags: ["Inbox"],
      request: {
        params: InboxItemParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: TransactionInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Create a transaction and process the inbox item atomically",
          content: {
            "application/json": {
              schema: z.object({ data: TransactionOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.confirm(
            context.req.valid("param").id,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/process",
      tags: ["Inbox"],
      request: {
        params: InboxItemParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ProcessInboxItemInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Link an owned transaction and mark the inbox item as processed",
          content: {
            "application/json": {
              schema: z.object({ data: InboxItemSummaryOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.process(
            context.req.valid("param").id,
            context.req.valid("json").transactionId,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Inbox"],
      request: { params: InboxItemParamsSchema },
      responses: {
        200: {
          description: "Delete a processed or discarded inbox item",
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
        ok(await service.remove(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  return route;
}

export function createCompanionInboxRoute(service: Pick<InboxService, "ingest" | "ingestBatch">) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({
    defaultHook: companionValidationHook,
  });

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Companion compatibility"],
      security: [{ deviceBearer: [] }],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CompanionInboxItemInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Notification accepted idempotently",
          content: {
            "application/json": {
              schema: CompanionInboxAcceptedOutputSchema,
            },
          },
        },
        400: companionCompatibilityError("Invalid notification"),
        401: {
          description: "Invalid token",
          content: {
            "application/json": { schema: CompanionDeviceAuthenticationErrorSchema },
          },
        },
        409: companionCompatibilityError("Idempotency conflict"),
        413: companionCompatibilityError("Payload too large"),
        429: companionCompatibilityError("Too many requests"),
        500: companionCompatibilityError("Internal error"),
      },
    }),
    async (context) => {
      const result = await service.ingest(context.req.valid("json"), {
        deviceTokenId: context.get("deviceTokenId"),
        userId: context.get("userId"),
      });
      return context.json(
        {
          id: result.id,
          clientId: result.clientId,
          message: result.duplicate ? "Notificação já recebida" : "Notificação recebida",
        },
        201,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/batch",
      tags: ["Companion compatibility"],
      security: [{ deviceBearer: [] }],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CompanionInboxBatchInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Notification batch accepted idempotently",
          content: {
            "application/json": {
              schema: CompanionInboxBatchOutputSchema,
            },
          },
        },
        400: companionCompatibilityError("Invalid notification batch"),
        401: {
          description: "Invalid token",
          content: {
            "application/json": { schema: CompanionDeviceAuthenticationErrorSchema },
          },
        },
        413: companionCompatibilityError("Payload too large"),
        429: companionCompatibilityError("Too many requests"),
        500: companionCompatibilityError("Internal error"),
      },
    }),
    async (context) => {
      const results = await service.ingestBatch(context.req.valid("json").items, {
        deviceTokenId: context.get("deviceTokenId"),
        userId: context.get("userId"),
      });
      const success = results.filter((result) => result.success).length;
      const failed = results.length - success;
      return context.json(
        {
          message: `${success} notificações processadas${failed ? `, ${failed} falharam` : ""}`,
          total: results.length,
          success,
          failed,
          results,
        },
        201,
      );
    },
  );

  return route;
}

function companionCompatibilityError(description: string) {
  return {
    description,
    content: { "application/json": { schema: CompanionInboxErrorSchema } },
  } as const;
}
