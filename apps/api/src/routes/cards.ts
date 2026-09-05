import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CardInvoicePeriodOutputSchema,
  CardInvoicePeriodQuerySchema,
  CardOutputSchema,
  CardParamsSchema,
  CardPeriodQuerySchema,
  CreateCardInputSchema,
  ReplaceCardInputSchema,
  UpdateCardInputSchema,
} from "@openmonetis/validators/cards";
import type { CardsService } from "../services/cards.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const CardResponseSchema = z.object({ data: CardOutputSchema, error: z.null() });
const CardsResponseSchema = z.object({ data: z.array(CardOutputSchema), error: z.null() });
const DeletedCardResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
  error: z.null(),
});
const errorResponses = {
  400: { description: "Invalid request", content: { "application/json": { schema: ErrorSchema } } },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: ErrorSchema } },
  },
  404: { description: "Card not found", content: { "application/json": { schema: ErrorSchema } } },
} as const;

export function createCardsRoute(service: CardsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Cards"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateCardInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created card",
          content: { "application/json": { schema: CardResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Cards"],
      request: { query: CardPeriodQuerySchema },
      responses: {
        200: {
          description: "List cards",
          content: { "application/json": { schema: CardsResponseSchema } },
        },
        401: errorResponses[401],
      },
    }),
    async (context) =>
      context.json(
        ok(await service.list(context.get("userId"), context.req.valid("query").period)),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}/invoice-period",
      tags: ["Cards"],
      request: { params: CardParamsSchema, query: CardInvoicePeriodQuerySchema },
      responses: {
        200: {
          description: "Calculated invoice period for a purchase",
          content: {
            "application/json": {
              schema: z.object({ data: CardInvoicePeriodOutputSchema, error: z.null() }),
            },
          },
        },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.quoteInvoicePeriod(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("query").purchaseDate,
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Cards"],
      request: { params: CardParamsSchema, query: CardPeriodQuerySchema },
      responses: {
        200: {
          description: "Get card",
          content: { "application/json": { schema: CardResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.get(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("query").period,
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      tags: ["Cards"],
      request: {
        params: CardParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceCardInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced card",
          content: { "application/json": { schema: CardResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.replace(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Cards"],
      request: { params: CardParamsSchema },
      responses: {
        200: {
          description: "Permanently deleted inactive card and its financial records",
          content: { "application/json": { schema: DeletedCardResponseSchema } },
        },
        401: errorResponses[401],
        404: errorResponses[404],
        409: {
          description: "Card must be inactive before permanent deletion",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.remove(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Cards"],
      request: {
        params: CardParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateCardInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated card",
          content: { "application/json": { schema: CardResponseSchema } },
        },
        400: errorResponses[400],
        401: errorResponses[401],
        404: errorResponses[404],
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.update(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  return route;
}
