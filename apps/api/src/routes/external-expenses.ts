import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ExternalExpenseOutputSchema,
  ExternalExpensePageOutputSchema,
  ExternalExpenseParamsSchema,
  ExternalExpenseSummaryOutputSchema,
  ImportExternalExpenseInputSchema,
  ImportExternalExpenseOutputSchema,
  ListExternalExpensesQuerySchema,
} from "@openmonetis/validators/external-expenses";
import type { ExternalExpensesService } from "../services/external-expenses.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

const errors = {
  400: error("Invalid request"),
  401: error("Authentication required"),
  404: error("External expense not found"),
  409: error("External expense state conflict"),
} as const;

const expenseResponse = {
  200: {
    description: "External expense",
    content: {
      "application/json": {
        schema: z.object({ data: ExternalExpenseOutputSchema, error: z.null() }),
      },
    },
  },
  ...errors,
} as const;

export function createExternalExpensesRoute(service: ExternalExpensesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["External expenses"],
      request: { query: ListExternalExpensesQuerySchema },
      responses: {
        200: {
          description: "Paginated external expenses",
          content: {
            "application/json": {
              schema: z.object({ data: ExternalExpensePageOutputSchema, error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(ok(await service.list(context.req.valid("query"), context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/summary",
      tags: ["External expenses"],
      responses: {
        200: {
          description: "External expense pending summary",
          content: {
            "application/json": {
              schema: z.object({ data: ExternalExpenseSummaryOutputSchema, error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) => context.json(ok(await service.summary(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["External expenses"],
      request: { params: ExternalExpenseParamsSchema },
      responses: expenseResponse,
    }),
    async (context) =>
      context.json(
        ok(await service.get(context.req.valid("param").id, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{id}/import",
      tags: ["External expenses"],
      request: {
        params: ExternalExpenseParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ImportExternalExpenseInputSchema } },
        },
      },
      responses: {
        200: {
          description: "External expense imported as a regular transaction",
          content: {
            "application/json": {
              schema: z.object({ data: ImportExternalExpenseOutputSchema, error: z.null() }),
            },
          },
        },
        ...errors,
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.importExpense(
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
