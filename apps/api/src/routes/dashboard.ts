import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  DashboardAccountsOutputSchema,
  DashboardCategoryBreakdownOutputSchema,
  DashboardExpenseDistributionOutputSchema,
  DashboardMetricsOutputSchema,
  DashboardPaymentStatusOutputSchema,
  DashboardPeopleExpensesOutputSchema,
  DashboardQuerySchema,
  DashboardSnapshotOutputSchema,
  DashboardWidgetPreferencesInputSchema,
  DashboardWidgetPreferencesOutputSchema,
} from "@openmonetis/validators/dashboard";
import type { DashboardService } from "../services/dashboard.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

export function createDashboardRoute(service: DashboardService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/snapshot",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Complete dashboard snapshot for a monthly period",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardSnapshotOutputSchema, error: z.null() }),
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
        ok(await service.getSnapshot(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/preferences",
      tags: ["Dashboard"],
      responses: {
        200: {
          description: "Current dashboard widget preferences",
          content: {
            "application/json": {
              schema: z.object({
                data: DashboardWidgetPreferencesOutputSchema,
                error: z.null(),
              }),
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
      context.json(ok(await service.getWidgetPreferences(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "put",
      path: "/preferences",
      tags: ["Dashboard"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: DashboardWidgetPreferencesInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Dashboard widget preferences updated",
          content: {
            "application/json": {
              schema: z.object({
                data: DashboardWidgetPreferencesOutputSchema,
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Invalid dashboard preferences",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.updateWidgetPreferences(context.req.valid("json"), context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/preferences",
      tags: ["Dashboard"],
      responses: {
        200: {
          description: "Dashboard widget preferences reset",
          content: {
            "application/json": {
              schema: z.object({
                data: DashboardWidgetPreferencesOutputSchema,
                error: z.null(),
              }),
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
      context.json(ok(await service.resetWidgetPreferences(context.get("userId"))), 200),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/people-expenses",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Expense totals grouped by person for a monthly period",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardPeopleExpensesOutputSchema, error: z.null() }),
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
        ok(
          await service.getPeopleExpenses(context.req.valid("query").period, context.get("userId")),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/category-breakdown",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Income and expense totals grouped by category for a monthly period",
          content: {
            "application/json": {
              schema: z.object({
                data: DashboardCategoryBreakdownOutputSchema,
                error: z.null(),
              }),
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
        ok(
          await service.getCategoryBreakdown(
            context.req.valid("query").period,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Dashboard metrics for a monthly period",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardMetricsOutputSchema, error: z.null() }),
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
        ok(await service.getMetrics(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/expense-distribution",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Expense distribution by condition and payment method",
          content: {
            "application/json": {
              schema: z.object({
                data: DashboardExpenseDistributionOutputSchema,
                error: z.null(),
              }),
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
        ok(
          await service.getExpenseDistribution(
            context.req.valid("query").period,
            context.get("userId"),
          ),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/payment-status",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Confirmed and pending dashboard amounts for a monthly period",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardPaymentStatusOutputSchema, error: z.null() }),
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
        ok(
          await service.getPaymentStatus(context.req.valid("query").period, context.get("userId")),
        ),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/accounts",
      tags: ["Dashboard"],
      request: { query: DashboardQuerySchema },
      responses: {
        200: {
          description: "Account balances for the dashboard period",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardAccountsOutputSchema, error: z.null() }),
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
        ok(await service.getAccounts(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );

  return route;
}
