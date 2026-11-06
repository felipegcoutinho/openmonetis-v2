import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ActivateAiToolInputSchema,
  AiToolEventsOutputSchema,
  AiToolJobOutputSchema,
  AiToolJobParamsSchema,
  AiToolOutputSchema,
  AiToolParamsSchema,
  AiToolsOutputSchema,
  InstallAiToolInputSchema,
} from "@openmonetis/validators/ai-tools";
import type { AiToolsService } from "../services/ai-tools.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const ToolsSchema = z.object({ data: AiToolsOutputSchema, error: z.null() });
const EventsSchema = z.object({ data: AiToolEventsOutputSchema, error: z.null() });
const ToolSchema = z.object({ data: AiToolOutputSchema, error: z.null() });
const JobSchema = z.object({ data: AiToolJobOutputSchema, error: z.null() });
const error = (description: string) =>
  ({ description, content: { "application/json": { schema: ErrorSchema } } }) as const;
const adminErrors = {
  401: error("Authentication required"),
  403: error("Only the installation admin manages AI tools"),
  503: error("AI service unavailable"),
} as const;

export function createAiToolsRoute(service: AiToolsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["AI tools"],
      responses: {
        200: {
          description: "The AI service's CLI builds, for the installation admin",
          content: { "application/json": { schema: ToolsSchema } },
        },
        401: error("Authentication required"),
        503: error("AI service unavailable"),
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/events",
      tags: ["AI tools"],
      responses: {
        200: {
          description: "Every change to the CLI builds, newest first",
          content: { "application/json": { schema: EventsSchema } },
        },
        ...adminErrors,
      },
    }),
    async (context) => context.json(ok(await service.listEvents(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{provider}/installs",
      tags: ["AI tools"],
      request: {
        params: AiToolParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: InstallAiToolInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Install started, or refused with its reason",
          content: { "application/json": { schema: JobSchema } },
        },
        400: error("Invalid version"),
        ...adminErrors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.install(
            context.get("userId"),
            context.req.valid("param").provider,
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{provider}/installs/{jobId}",
      tags: ["AI tools"],
      request: { params: AiToolJobParamsSchema },
      responses: {
        200: {
          description: "Progress of an install",
          content: { "application/json": { schema: JobSchema } },
        },
        404: error("Install not found"),
        ...adminErrors,
      },
    }),
    async (context) => {
      const { provider, jobId } = context.req.valid("param");
      return context.json(ok(await service.getJob(context.get("userId"), provider, jobId)), 200);
    },
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/{provider}/active",
      tags: ["AI tools"],
      request: {
        params: AiToolParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ActivateAiToolInputSchema } },
        },
      },
      responses: {
        200: {
          description: "The build the provider now runs",
          content: { "application/json": { schema: ToolSchema } },
        },
        400: error("Invalid version"),
        409: error("Version not installed or an install is running"),
        ...adminErrors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.activate(
            context.get("userId"),
            context.req.valid("param").provider,
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  return route;
}
