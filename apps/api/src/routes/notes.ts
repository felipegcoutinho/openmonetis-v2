import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ArchiveNoteInputSchema,
  CreateNoteInputSchema,
  DeleteNoteQuerySchema,
  ListNotesQuerySchema,
  NoteItemParamsSchema,
  NoteOutputSchema,
  NoteParamsSchema,
  NotesPageOutputSchema,
  ReplaceNoteInputSchema,
  SetNoteItemCompletionInputSchema,
  SetTaskCompletionInputSchema,
} from "@openmonetis/validators/notes";
import type { NotesService } from "../services/notes.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const NoteResponseSchema = z.object({ data: NoteOutputSchema, error: z.null() });
const NotesPageResponseSchema = z.object({ data: NotesPageOutputSchema, error: z.null() });
const DeleteResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
  error: z.null(),
});
const errorResponses = {
  400: {
    description: "Invalid note request",
    content: { "application/json": { schema: ErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "Note or checklist item not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  409: {
    description: "The note changed after it was opened",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createNotesRoute(service: NotesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Notes"],
      request: { query: ListNotesQuerySchema },
      responses: {
        200: {
          description: "Paginated notes",
          content: { "application/json": { schema: NotesPageResponseSchema } },
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
      method: "patch",
      path: "/{id}/completion",
      tags: ["Notes"],
      request: {
        params: NoteParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: SetTaskCompletionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated task completion",
          content: { "application/json": { schema: NoteResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.setTaskCompletion(id, context.req.valid("json"), context.get("userId"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Notes"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateNoteInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created note",
          content: { "application/json": { schema: NoteResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Notes"],
      request: { params: NoteParamsSchema },
      responses: {
        200: {
          description: "Note details",
          content: { "application/json": { schema: NoteResponseSchema } },
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
      method: "put",
      path: "/{id}",
      tags: ["Notes"],
      request: {
        params: NoteParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceNoteInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced note",
          content: { "application/json": { schema: NoteResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.replace(id, context.req.valid("json"), context.get("userId"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}/archive",
      tags: ["Notes"],
      request: {
        params: NoteParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ArchiveNoteInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Archived or restored note",
          content: { "application/json": { schema: NoteResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.archive(id, context.req.valid("json"), context.get("userId"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{noteId}/items/{itemId}",
      tags: ["Notes"],
      request: {
        params: NoteItemParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: SetNoteItemCompletionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated checklist item",
          content: { "application/json": { schema: NoteResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => {
      const { noteId, itemId } = context.req.valid("param");
      return context.json(
        ok(
          await service.setItemCompletion(
            noteId,
            itemId,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Notes"],
      request: { params: NoteParamsSchema, query: DeleteNoteQuerySchema },
      responses: {
        200: {
          description: "Deleted note",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
        409: errorResponses[409],
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      const { expectedVersion } = context.req.valid("query");
      return context.json(
        ok(await service.remove(id, expectedVersion, context.get("userId"))),
        200,
      );
    },
  );

  return route;
}
