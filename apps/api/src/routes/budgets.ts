import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  BudgetOutputSchema,
  BudgetOverviewOutputSchema,
  BudgetParamsSchema,
  CopyPreviousBudgetsInputSchema,
  CopyPreviousBudgetsOutputSchema,
  CreateBudgetInputSchema,
  ListBudgetsQuerySchema,
  UpdateBudgetInputSchema,
} from "@openmonetis/validators/budgets";
import type { BudgetsService } from "../services/budgets.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const BudgetResponseSchema = z.object({ data: BudgetOutputSchema, error: z.null() });
const BudgetOverviewResponseSchema = z.object({
  data: BudgetOverviewOutputSchema,
  error: z.null(),
});
const CopyResponseSchema = z.object({
  data: CopyPreviousBudgetsOutputSchema,
  error: z.null(),
});
const DeleteResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
  error: z.null(),
});

export function createBudgetsRoute(service: BudgetsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Budgets"],
      request: { query: ListBudgetsQuerySchema },
      responses: {
        200: {
          description: "Budget overview for a period",
          content: { "application/json": { schema: BudgetOverviewResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.list(context.get("userId"), context.req.valid("query"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Budgets"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateBudgetInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created budget",
          content: { "application/json": { schema: BudgetResponseSchema } },
        },
        400: {
          description: "Invalid or duplicate budget",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Expense category not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.create(context.req.valid("json"), context.get("userId"))), 201),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/copy-previous",
      tags: ["Budgets"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CopyPreviousBudgetsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Copied budgets from the previous period",
          content: { "application/json": { schema: CopyResponseSchema } },
        },
        400: {
          description: "No budgets available to copy",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.copyPrevious(context.req.valid("json"), context.get("userId"))),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Budgets"],
      request: { params: BudgetParamsSchema },
      responses: {
        200: {
          description: "Get budget",
          content: { "application/json": { schema: BudgetResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Budget not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(ok(await service.get(id, context.get("userId"))), 200);
    },
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Budgets"],
      request: {
        params: BudgetParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateBudgetInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated budget",
          content: { "application/json": { schema: BudgetResponseSchema } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Budget not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.update(id, context.get("userId"), context.req.valid("json"))),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Budgets"],
      request: { params: BudgetParamsSchema },
      responses: {
        200: {
          description: "Deleted budget",
          content: { "application/json": { schema: DeleteResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Budget not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(ok(await service.remove(id, context.get("userId"))), 200);
    },
  );

  return route;
}
