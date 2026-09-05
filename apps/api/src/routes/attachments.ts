import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AttachmentOutputSchema,
  AttachmentParamsSchema,
  AttachmentUrlOutputSchema,
  AttachmentUrlQuerySchema,
  ConfirmAttachmentInputSchema,
  ListAttachmentsQuerySchema,
  PaginatedAttachmentsOutputSchema,
  PrepareAttachmentInputSchema,
  PreparedAttachmentOutputSchema,
  TransactionAttachmentItemParamsSchema,
  TransactionAttachmentParamsSchema,
} from "@openmonetis/validators/attachments";
import type { AttachmentsService } from "../services/attachments.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const AttachmentResponseSchema = z.object({ data: AttachmentOutputSchema, error: z.null() });
const AttachmentsResponseSchema = z.object({
  data: z.array(AttachmentOutputSchema),
  error: z.null(),
});
const PaginatedAttachmentsResponseSchema = z.object({
  data: PaginatedAttachmentsOutputSchema,
  error: z.null(),
});
const AttachmentUrlResponseSchema = z.object({
  data: AttachmentUrlOutputSchema,
  error: z.null(),
});
const DeleteAttachmentResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
  error: z.null(),
});
const DetachAttachmentResponseSchema = z.object({
  data: z.object({
    id: z.uuid(),
    transactionId: z.uuid(),
    deleted: z.boolean(),
  }),
  error: z.null(),
});
const errorResponses = {
  400: { description: "Invalid request", content: { "application/json": { schema: ErrorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: { description: "Not found", content: { "application/json": { schema: ErrorSchema } } },
  503: {
    description: "Attachment storage unavailable",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createAttachmentsRoute(service: AttachmentsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Attachments"],
      request: { query: ListAttachmentsQuerySchema },
      responses: {
        200: {
          description: "Attachments for a period",
          content: { "application/json": { schema: PaginatedAttachmentsResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    }),
    async (context) =>
      context.json(ok(await service.list(context.get("userId"), context.req.valid("query"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/prepare",
      tags: ["Attachments"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: PrepareAttachmentInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Prepared upload",
          content: {
            "application/json": {
              schema: z.object({ data: PreparedAttachmentOutputSchema, error: z.null() }),
            },
          },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.prepare(context.req.valid("json"), context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/confirm",
      tags: ["Attachments"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: ConfirmAttachmentInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Confirmed attachment",
          content: { "application/json": { schema: AttachmentResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(
        ok(await service.confirm(context.req.valid("json"), context.get("userId"))),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/transaction/{transactionId}",
      tags: ["Attachments"],
      request: { params: TransactionAttachmentParamsSchema },
      responses: {
        200: {
          description: "Transaction attachments",
          content: { "application/json": { schema: AttachmentsResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.listForTransaction(
            context.req.valid("param").transactionId,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/transaction/{transactionId}/{attachmentId}",
      tags: ["Attachments"],
      request: { params: TransactionAttachmentItemParamsSchema },
      responses: {
        200: {
          description: "Detached transaction attachment",
          content: { "application/json": { schema: DetachAttachmentResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) => {
      const { transactionId, attachmentId } = context.req.valid("param");
      return context.json(
        ok(await service.detach(transactionId, attachmentId, context.get("userId"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}/download-url",
      tags: ["Attachments"],
      request: { params: AttachmentParamsSchema, query: AttachmentUrlQuerySchema },
      responses: {
        200: {
          description: "Short-lived attachment URL",
          content: { "application/json": { schema: AttachmentUrlResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
        503: errorResponses[503],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.getDownloadUrl(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("query").disposition,
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Attachments"],
      request: { params: AttachmentParamsSchema },
      responses: {
        200: {
          description: "Deleted attachment from every linked transaction",
          content: { "application/json": { schema: DeleteAttachmentResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
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
