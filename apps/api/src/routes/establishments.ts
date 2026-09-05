import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  EstablishmentLogoOutputSchema,
  EstablishmentLogoQuerySchema,
  EstablishmentLogoSearchOutputSchema,
  RemoveEstablishmentLogoQuerySchema,
  SearchEstablishmentLogosQuerySchema,
  SetEstablishmentLogoInputSchema,
} from "@openmonetis/validators/establishments";
import type { EstablishmentsService } from "../services/establishments.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const LogoResponseSchema = z.object({ data: EstablishmentLogoOutputSchema, error: z.null() });
const SearchResponseSchema = z.object({
  data: EstablishmentLogoSearchOutputSchema,
  error: z.null(),
});
const errors = {
  400: { description: "Invalid request", content: { "application/json": { schema: ErrorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  503: {
    description: "Logo.dev unavailable",
    content: { "application/json": { schema: ErrorSchema } },
  },
} as const;

export function createEstablishmentsRoute(service: EstablishmentsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/logo",
      tags: ["Establishments"],
      request: { query: EstablishmentLogoQuerySchema },
      responses: {
        200: {
          description: "User logo mapping",
          content: { "application/json": { schema: LogoResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.getLogo(context.req.valid("query").name, context.get("userId"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/logo/search",
      tags: ["Establishments"],
      request: { query: SearchEstablishmentLogosQuerySchema },
      responses: {
        200: {
          description: "Logo.dev brand matches",
          content: { "application/json": { schema: SearchResponseSchema } },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(ok(await service.searchLogos(context.req.valid("query").q)), 200),
  );
  route.openapi(
    createRoute({
      method: "put",
      path: "/logo",
      tags: ["Establishments"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SetEstablishmentLogoInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Saved logo mapping",
          content: { "application/json": { schema: LogoResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.setLogo(context.req.valid("json"), context.get("userId"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "delete",
      path: "/logo",
      tags: ["Establishments"],
      request: { query: RemoveEstablishmentLogoQuerySchema },
      responses: {
        200: {
          description: "Removed logo mapping",
          content: { "application/json": { schema: LogoResponseSchema } },
        },
        400: errors[400],
        401: errors[401],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.removeLogo(context.req.valid("query").name, context.get("userId"))),
        200,
      ),
  );
  return route;
}
