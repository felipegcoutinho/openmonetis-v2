import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AiProviderLoginOutputSchema,
  AiProviderLoginParamsSchema,
  AiProviderOutputSchema,
  AiProviderParamsSchema,
  AiProvidersOutputSchema,
  StartAiProviderLoginInputSchema,
  SubmitAiProviderLoginCodeInputSchema,
  UpdateAiProviderInputSchema,
} from "@openmonetis/validators/ai-providers";
import type { AiProvidersService } from "../services/ai-providers.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const ProvidersResponseSchema = z.object({ data: AiProvidersOutputSchema, error: z.null() });
const ProviderResponseSchema = z.object({ data: AiProviderOutputSchema, error: z.null() });
const LoginResponseSchema = z.object({ data: AiProviderLoginOutputSchema, error: z.null() });
const errorResponses = {
  400: {
    description: "Invalid AI provider request",
    content: { "application/json": { schema: ErrorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: {
    description: "Sign-in not found",
    content: { "application/json": { schema: ErrorSchema } },
  },
  503: {
    description: "AI features are disabled or the AI service is unavailable",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createAiProvidersRoute(service: AiProvidersService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["AI providers"],
      responses: {
        200: {
          description: "AI provider connections",
          content: { "application/json": { schema: ProvidersResponseSchema } },
        },
        401: errorResponses[401],
      },
    }),
    async (context) => context.json(ok(await service.list(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{provider}/logins",
      tags: ["AI providers"],
      request: {
        params: AiProviderParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: StartAiProviderLoginInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Started provider sign-in",
          content: { "application/json": { schema: LoginResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        503: errorResponses[503],
      },
    }),
    async (context) => {
      const { provider } = context.req.valid("param");
      return context.json(
        ok(await service.startLogin(context.get("userId"), provider, context.req.valid("json"))),
        201,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{provider}/logins/{loginId}",
      tags: ["AI providers"],
      request: { params: AiProviderLoginParamsSchema },
      responses: {
        200: {
          description: "Provider sign-in status",
          content: { "application/json": { schema: LoginResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => {
      const { provider, loginId } = context.req.valid("param");
      return context.json(
        ok(await service.getLogin(context.get("userId"), provider, loginId)),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{provider}/logins/{loginId}/code",
      tags: ["AI providers"],
      request: {
        params: AiProviderLoginParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: SubmitAiProviderLoginCodeInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Provider sign-in status after the code was handed to the CLI",
          content: { "application/json": { schema: LoginResponseSchema } },
        },
        ...errorResponses,
      },
    }),
    async (context) => {
      const { provider, loginId } = context.req.valid("param");
      return context.json(
        ok(
          await service.submitLoginCode(
            context.get("userId"),
            provider,
            loginId,
            context.req.valid("json"),
          ),
        ),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{provider}",
      tags: ["AI providers"],
      request: {
        params: AiProviderParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateAiProviderInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated provider preferences",
          content: { "application/json": { schema: ProviderResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        409: {
          description: "Provider not connected",
          content: { "application/json": { schema: ErrorSchema } },
        },
        503: errorResponses[503],
      },
    }),
    async (context) => {
      const { provider } = context.req.valid("param");
      return context.json(
        ok(await service.update(context.get("userId"), provider, context.req.valid("json"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{provider}",
      tags: ["AI providers"],
      request: { params: AiProviderParamsSchema },
      responses: {
        200: {
          description: "Disconnected provider",
          content: { "application/json": { schema: ProviderResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        503: errorResponses[503],
      },
    }),
    async (context) => {
      const { provider } = context.req.valid("param");
      return context.json(ok(await service.disconnect(context.get("userId"), provider)), 200);
    },
  );

  return route;
}
