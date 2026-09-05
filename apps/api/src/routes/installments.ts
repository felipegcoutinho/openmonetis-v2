import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  CreateInstallmentAnticipationInputSchema,
  DashboardInstallmentExpensesOutputSchema,
  InstallmentAnticipationDetailsOutputSchema,
  InstallmentAnticipationOutputSchema,
  InstallmentAnticipationParamsSchema,
  InstallmentQuoteOutputSchema,
  InstallmentSeriesParamsSchema,
  InstallmentsReportOutputSchema,
  ListInstallmentsQuerySchema,
  QuoteInstallmentsInputSchema,
  UndoInstallmentAnticipationInputSchema,
  UndoInstallmentAnticipationOutputSchema,
} from "@openmonetis/validators/installments";
import type { InstallmentsService } from "../services/installments.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const InstallmentsReportResponseSchema = z.object({
  data: InstallmentsReportOutputSchema,
  error: z.null(),
});

const InstallmentQuoteResponseSchema = z.object({
  data: InstallmentQuoteOutputSchema,
  error: z.null(),
});

export function createInstallmentsRoute(service: InstallmentsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });

  route.openapi(
    createRoute({
      method: "get",
      path: "/dashboard",
      tags: ["Dashboard"],
      request: { query: ListInstallmentsQuerySchema.pick({ period: true }) },
      responses: {
        200: {
          description: "Installment expenses in the dashboard period",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardInstallmentExpensesOutputSchema, error: z.null() }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.dashboard(context.get("userId"), context.req.valid("query").period)),
        200,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Reports"],
      request: { query: ListInstallmentsQuerySchema },
      responses: {
        200: {
          description: "Installment series report for a reference period",
          content: { "application/json": { schema: InstallmentsReportResponseSchema } },
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
      path: "/quote",
      tags: ["Reports"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: QuoteInstallmentsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Total for a selection of pending installments",
          content: { "application/json": { schema: InstallmentQuoteResponseSchema } },
        },
        400: {
          description: "Invalid installment selection",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(ok(await service.quote(context.get("userId"), context.req.valid("json"))), 200),
  );

  route.openapi(
    createRoute({
      method: "post",
      path: "/{seriesId}/anticipations",
      tags: ["Installments"],
      request: {
        params: InstallmentSeriesParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreateInstallmentAnticipationInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Future installments moved into an earlier credit card invoice",
          content: {
            "application/json": {
              schema: z.object({ data: InstallmentAnticipationOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid or ineligible installment selection",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        409: {
          description: "Installments changed during anticipation",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.anticipate(
            context.get("userId"),
            context.req.valid("param").seriesId,
            context.req.valid("json"),
          ),
        ),
        201,
      ),
  );

  route.openapi(
    createRoute({
      method: "get",
      path: "/{seriesId}/anticipations/{anticipationId}",
      tags: ["Installments"],
      request: { params: InstallmentAnticipationParamsSchema },
      responses: {
        200: {
          description: "Anticipation details and its current installments",
          content: {
            "application/json": {
              schema: z.object({
                data: InstallmentAnticipationDetailsOutputSchema,
                error: z.null(),
              }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Anticipation not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const params = context.req.valid("param");
      return context.json(
        ok(
          await service.getAnticipation(
            context.get("userId"),
            params.seriesId,
            params.anticipationId,
          ),
        ),
        200,
      );
    },
  );

  route.openapi(
    createRoute({
      method: "patch",
      path: "/{seriesId}/anticipations/{anticipationId}",
      tags: ["Installments"],
      request: {
        params: InstallmentAnticipationParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UndoInstallmentAnticipationInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Selected anticipated installments restored to their original invoices",
          content: {
            "application/json": {
              schema: z.object({
                data: UndoInstallmentAnticipationOutputSchema,
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Anticipation cannot be undone",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Anticipation not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const params = context.req.valid("param");
      return context.json(
        ok(
          await service.undoAnticipation(
            context.get("userId"),
            params.seriesId,
            params.anticipationId,
            context.req.valid("json"),
          ),
        ),
        200,
      );
    },
  );

  return route;
}
