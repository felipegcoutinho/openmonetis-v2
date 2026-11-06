import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AiDiagnosesOutputSchema,
  AiDiagnosisOutputSchema,
  AiDiagnosisParamsSchema,
  CreateAiDiagnosisInputSchema,
} from "@openmonetis/validators/ai-diagnoses";
import type { AiDiagnosesService } from "../services/ai-diagnoses.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const DiagnosisResponseSchema = z.object({ data: AiDiagnosisOutputSchema, error: z.null() });
const DiagnosesResponseSchema = z.object({ data: AiDiagnosesOutputSchema, error: z.null() });
const DeleteResponseSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });
const errorResponses = {
  400: {
    description: "Invalid diagnosis request or no data to diagnose",
    content: { "application/json": { schema: ErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "Diagnosis not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  409: {
    description: "Provider not connected, diagnosis in progress or daily limit reached",
    content: { "application/json": { schema: ErrorSchema } },
  },
  503: {
    description: "AI service unavailable",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createAiDiagnosesRoute(service: AiDiagnosesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["AI diagnoses"],
      responses: {
        200: {
          description: "Recent financial health diagnoses",
          content: { "application/json": { schema: DiagnosesResponseSchema } },
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
      tags: ["AI diagnoses"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateAiDiagnosisInputSchema } },
        },
      },
      responses: {
        202: {
          description: "Diagnosis accepted; poll it until it is completed or failed",
          content: { "application/json": { schema: DiagnosisResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        409: errorResponses[409],
        503: errorResponses[503],
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.get("userId"), context.req.valid("json"))), 202),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["AI diagnoses"],
      request: { params: AiDiagnosisParamsSchema },
      responses: {
        200: {
          description: "Diagnosis details",
          content: { "application/json": { schema: DiagnosisResponseSchema } },
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
      method: "post",
      path: "/{id}/cancel",
      tags: ["AI diagnoses"],
      request: { params: AiDiagnosisParamsSchema },
      responses: {
        200: {
          description: "Stopped diagnosis, now failed with the canceled code",
          content: { "application/json": { schema: DiagnosisResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
        409: {
          description: "The diagnosis is no longer running",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(ok(await service.cancel(id, context.get("userId"))), 200);
    },
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["AI diagnoses"],
      request: { params: AiDiagnosisParamsSchema },
      responses: {
        200: {
          description: "Deleted diagnosis; a running one is stopped first",
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

  return route;
}
