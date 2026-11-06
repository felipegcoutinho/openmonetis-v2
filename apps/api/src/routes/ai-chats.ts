import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AiChatOutputSchema,
  AiChatParamsSchema,
  AiChatStreamEventSchema,
  AiChatSummaryOutputSchema,
  AiChatsOutputSchema,
  CreateAiChatInputSchema,
  RegenerateAiChatReplyInputSchema,
  SendAiChatMessageInputSchema,
  UpdateAiChatInputSchema,
} from "@openmonetis/validators/ai-chats";
import type { Context } from "hono";
import { streamSSE } from "hono/streaming";
import type { AiChatsService } from "../services/ai-chats.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const ChatResponseSchema = z.object({ data: AiChatOutputSchema, error: z.null() });
const ChatsResponseSchema = z.object({ data: AiChatsOutputSchema, error: z.null() });
const SummaryResponseSchema = z.object({ data: AiChatSummaryOutputSchema, error: z.null() });
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: ErrorSchema } },
});
const errorResponses = {
  400: errorResponse("Invalid chat request"),
  401: errorResponse("Authentication required"),
  404: errorResponse("Chat not found"),
  409: errorResponse("Provider not connected, a reply in progress or daily limit reached"),
  503: errorResponse("AI service unavailable"),
} as const;
const streamResponse = {
  200: {
    description:
      "Server-sent events: `start`, then `reasoning` and `delta` while the reply is written, then `done` with the saved message. Closing the connection stops the reply.",
    content: { "text/event-stream": { schema: AiChatStreamEventSchema } },
  },
  ...errorResponses,
} as const;

type ChatContext = Context<{ Variables: ApiVariables }>;
type ReplyStream = AsyncGenerator<z.infer<typeof AiChatStreamEventSchema>>;

/** Streams a reply; the abort signal stops the provider when the client disconnects. */
async function streamReply(
  context: ChatContext,
  start: (signal: AbortSignal) => Promise<ReplyStream>,
) {
  const controller = new AbortController();
  const events = await start(controller.signal);
  return streamSSE(context, async (stream) => {
    stream.onAbort(() => controller.abort());
    for await (const event of events) {
      if (stream.aborted) break;
      await stream.writeSSE({ event: event.type, data: JSON.stringify(event) });
    }
  });
}

export function createAiChatsRoute(service: AiChatsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["AI chats"],
      responses: {
        200: {
          description: "Recent chats",
          content: { "application/json": { schema: ChatsResponseSchema } },
        },
        401: errorResponses[401],
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["AI chats"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateAiChatInputSchema } },
        },
      },
      responses: {
        201: {
          description: "New chat",
          content: { "application/json": { schema: ChatResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.get("userId"), context.req.valid("json"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["AI chats"],
      request: { params: AiChatParamsSchema },
      responses: {
        200: {
          description: "Chat with its messages",
          content: { "application/json": { schema: ChatResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(ok(await service.get(id, context.get("userId"))), 200);
    },
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["AI chats"],
      request: {
        params: AiChatParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateAiChatInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Renamed chat",
          content: { "application/json": { schema: SummaryResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.update(id, context.get("userId"), context.req.valid("json"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["AI chats"],
      request: { params: AiChatParamsSchema },
      responses: {
        200: {
          description: "Deleted chat and its messages",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(ok(await service.delete(id, context.get("userId"))), 200);
    },
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/messages",
      tags: ["AI chats"],
      request: {
        params: AiChatParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: SendAiChatMessageInputSchema } },
        },
      },
      responses: streamResponse,
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      const input = context.req.valid("json");
      return streamReply(context, (signal) =>
        service.send(context.get("userId"), id, input, signal),
      );
    },
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/regenerate",
      tags: ["AI chats"],
      request: {
        params: AiChatParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: RegenerateAiChatReplyInputSchema } },
        },
      },
      responses: streamResponse,
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      const input = context.req.valid("json");
      return streamReply(context, (signal) =>
        service.regenerate(context.get("userId"), id, input, signal),
      );
    },
  );

  return route;
}
