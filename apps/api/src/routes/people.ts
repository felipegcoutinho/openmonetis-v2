import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreatePersonInputSchema,
  PersonFinancialSummaryOutputSchema,
  PersonOutputSchema,
  PersonParamsSchema,
  PersonSummaryQuerySchema,
  ReplacePersonInputSchema,
  UpdatePersonInputSchema,
} from "@openmonetis/validators/people";
import type { PeopleService } from "../services/people.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const OneSchema = z.object({ data: PersonOutputSchema, error: z.null() });
const SummarySchema = z.object({ data: PersonFinancialSummaryOutputSchema, error: z.null() });
const ManySchema = z.object({ data: z.array(PersonOutputSchema), error: z.null() });
const DeletedSchema = z.object({ data: z.object({ id: z.uuid() }), error: z.null() });

export function createPeopleRoute(service: PeopleService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["People"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreatePersonInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created person",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid request"),
        401: error("Authentication required"),
      },
    }),
    async (c) => c.json(ok(await service.create(c.req.valid("json"), c.get("userId"))), 201),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/admin",
      tags: ["People"],
      responses: {
        200: {
          description: "Get admin person",
          content: { "application/json": { schema: OneSchema } },
        },
        401: error("Authentication required"),
        404: error("Admin person not found"),
      },
    }),
    async (c) => c.json(ok(await service.getAdmin(c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}/summary",
      tags: ["People"],
      request: { params: PersonParamsSchema, query: PersonSummaryQuerySchema },
      responses: {
        200: {
          description: "Get person financial summary",
          content: { "application/json": { schema: SummarySchema } },
        },
        400: error("Invalid period"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(
          await service.getFinancialSummary(
            c.req.valid("param").id,
            c.get("userId"),
            c.req.valid("query").period,
          ),
        ),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["People"],
      responses: {
        200: {
          description: "List people",
          content: { "application/json": { schema: ManySchema } },
        },
        401: error("Authentication required"),
      },
    }),
    async (c) => c.json(ok(await service.list(c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["People"],
      request: { params: PersonParamsSchema },
      responses: {
        200: { description: "Get person", content: { "application/json": { schema: OneSchema } } },
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) => c.json(ok(await service.get(c.req.valid("param").id, c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      tags: ["People"],
      request: {
        params: PersonParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplacePersonInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced person",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid request"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(await service.replace(c.req.valid("param").id, c.get("userId"), c.req.valid("json"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["People"],
      request: {
        params: PersonParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdatePersonInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated person",
          content: { "application/json": { schema: OneSchema } },
        },
        400: error("Invalid request"),
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) =>
      c.json(
        ok(await service.update(c.req.valid("param").id, c.get("userId"), c.req.valid("json"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["People"],
      request: { params: PersonParamsSchema },
      responses: {
        200: {
          description: "Deleted person",
          content: { "application/json": { schema: DeletedSchema } },
        },
        401: error("Authentication required"),
        404: error("Person not found"),
      },
    }),
    async (c) => c.json(ok(await service.remove(c.req.valid("param").id, c.get("userId"))), 200),
  );
  return route;
}
