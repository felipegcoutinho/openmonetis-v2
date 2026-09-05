import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  ListRecurringExpensesQuerySchema,
  RecurringExpenseActionOutputSchema,
  RecurringExpenseParamsSchema,
  RecurringExpensesOutputSchema,
  RecurringExpensesReportOutputSchema,
  UpdateRecurringExpenseInputSchema,
} from "@openmonetis/validators/recurring-expenses";
import type { RecurringExpensesService } from "../services/recurring-expenses.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

export function createRecurringExpensesRoute(service: RecurringExpensesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/report",
      tags: ["Reports"],
      request: { query: ListRecurringExpensesQuerySchema },
      responses: {
        200: {
          description: "Recurring expenses report for the administrator person",
          content: {
            "application/json": {
              schema: z.object({ data: RecurringExpensesReportOutputSchema, error: z.null() }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.report(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Dashboard"],
      request: { query: ListRecurringExpensesQuerySchema },
      responses: {
        200: {
          description: "Recurring expenses in the selected dashboard period",
          content: {
            "application/json": {
              schema: z.object({ data: RecurringExpensesOutputSchema, error: z.null() }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.list(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}/occurrences/{purchaseDate}",
      tags: ["Recurring expenses"],
      request: {
        params: RecurringExpenseParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateRecurringExpenseInputSchema } },
        },
      },
      responses: actionResponses("Updated recurring expense occurrence"),
    }),
    async (context) => {
      const params = context.req.valid("param");
      return context.json(
        ok(
          await service.update(
            params.id,
            params.purchaseDate,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        200,
      );
    },
  );

  for (const action of ["pause", "resume", "skip", "stop"] as const) {
    route.openapi(
      createRoute({
        method: "post",
        path: `/{id}/occurrences/{purchaseDate}/${action}`,
        tags: ["Recurring expenses"],
        request: { params: RecurringExpenseParamsSchema },
        responses: actionResponses(`${action} recurring expense occurrence`),
      }),
      async (context) => {
        const params = context.req.valid("param");
        return context.json(
          ok(await service[action](params.id, params.purchaseDate, context.get("userId"))),
          200,
        );
      },
    );
  }

  return route;
}

function actionResponses(description: string) {
  return {
    200: {
      description,
      content: {
        "application/json": {
          schema: z.object({ data: RecurringExpenseActionOutputSchema, error: z.null() }),
        },
      },
    },
    400: {
      description: "Invalid occurrence",
      content: { "application/json": { schema: errorSchema } },
    },
    401: {
      description: "Authentication required",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Recurring expense not found",
      content: { "application/json": { schema: errorSchema } },
    },
  } as const;
}
