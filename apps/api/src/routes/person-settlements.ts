import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreatePersonSettlementInputSchema,
  PersonSettlementOutputSchema,
  PersonSettlementParamsSchema,
  PersonSettlementPeriodQuerySchema,
  PersonSettlementPersonParamsSchema,
  PersonSettlementSnapshotOutputSchema,
  PersonSettlementsSummaryOutputSchema,
} from "@openmonetis/validators/person-settlements";
import type { PersonSettlementsService } from "../services/person-settlements.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const OneSchema = z.object({ data: PersonSettlementOutputSchema, error: z.null() });
const SnapshotSchema = z.object({ data: PersonSettlementSnapshotOutputSchema, error: z.null() });
const SummarySchema = z.object({ data: PersonSettlementsSummaryOutputSchema, error: z.null() });
const DeletedSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });

export function createPersonSettlementsRoute(service: PersonSettlementsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Person settlements"],
      request: { query: PersonSettlementPeriodQuerySchema },
      responses: {
        200: {
          description: "List outstanding settlement balances by person",
          content: { "application/json": { schema: SummarySchema } },
        },
        401: error("Authentication required"),
      },
    }),
    async (c) =>
      c.json(ok(await service.getSummary(c.get("userId"), c.req.valid("query").period)), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/people/{personId}",
      tags: ["Person settlements"],
      request: {
        params: PersonSettlementPersonParamsSchema,
        query: PersonSettlementPeriodQuerySchema,
      },
      responses: {
        200: {
          description: "Get a person's settlement snapshot",
          content: { "application/json": { schema: SnapshotSchema } },
        },
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await service.getSnapshot(
            c.req.valid("param").personId,
            c.get("userId"),
            c.req.valid("query").period,
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Person settlements"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreatePersonSettlementInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Register a settlement",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid settlement"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) => c.json(ok(await service.create(c.req.valid("json"), c.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Person settlements"],
      request: { params: PersonSettlementParamsSchema },
      responses: {
        200: {
          description: "Delete a settlement",
          content: { "application/json": { schema: DeletedSchema } },
        },
        401: error("Authentication required"),
        404: error("Settlement not found"),
      },
    }),
    async (c) => c.json(ok(await service.remove(c.req.valid("param").id, c.get("userId"))), 200),
  );

  return route;
}
