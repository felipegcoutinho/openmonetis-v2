import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AdjustInvoiceInputSchema,
  CreateInvoicePaymentInputSchema,
  DashboardInvoicesOutputSchema,
  InvoiceAdjustmentOutputSchema,
  InvoiceParamsSchema,
  InvoicePaymentOutputSchema,
  InvoicePaymentParamsSchema,
  ListInvoicesQuerySchema,
  UndoInvoicePaymentOutputSchema,
  UpdateInvoiceDatesInputSchema,
} from "@openmonetis/validators/invoices";
import type { InvoicesService } from "../services/invoices.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";
export function createInvoicesRoute(service: InvoicesService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "patch",
      path: "/{cardId}/{period}/dates",
      tags: ["Invoices"],
      request: {
        params: InvoiceParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateInvoiceDatesInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Invoice effective dates updated",
          content: {
            "application/json": {
              schema: z.object({ data: UpdateInvoiceDatesInputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid invoice dates",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Card not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { cardId, period } = c.req.valid("param");
      return c.json(
        ok(await service.updateDates(cardId, period, c.req.valid("json"), c.get("userId"))),
        200,
      );
    },
  );
  route.openapi(
    createRoute({
      method: "post",
      path: "/{cardId}/{period}/adjustments",
      tags: ["Invoices"],
      request: {
        params: InvoiceParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: AdjustInvoiceInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Invoice amount adjusted",
          content: {
            "application/json": {
              schema: z.object({ data: InvoiceAdjustmentOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid invoice adjustment",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Invoice adjustment dependency not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { cardId, period } = c.req.valid("param");
      return c.json(
        ok(await service.adjust(cardId, period, c.req.valid("json"), c.get("userId"))),
        200,
      );
    },
  );
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Invoices"],
      request: { query: ListInvoicesQuerySchema },
      responses: {
        200: {
          description: "Invoice dashboard snapshot",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardInvoicesOutputSchema, error: z.null() }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => c.json(ok(await service.get(c.req.valid("query").period, c.get("userId"))), 200),
  );
  route.openapi(
    createRoute({
      method: "post",
      path: "/{cardId}/{period}/payments",
      tags: ["Invoices"],
      request: {
        params: InvoiceParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreateInvoicePaymentInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Invoice payment created",
          content: {
            "application/json": {
              schema: z.object({ data: InvoicePaymentOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid payment",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Invoice not found",
          content: { "application/json": { schema: errorSchema } },
        },
        409: {
          description: "Invoice changed during payment",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { cardId, period } = c.req.valid("param");
      return c.json(
        ok(await service.pay(cardId, period, c.req.valid("json"), c.get("userId"))),
        201,
      );
    },
  );
  route.openapi(
    createRoute({
      method: "delete",
      path: "/{cardId}/{period}/payments/{paymentId}",
      tags: ["Invoices"],
      request: { params: InvoicePaymentParamsSchema },
      responses: {
        200: {
          description: "Invoice payment undone",
          content: {
            "application/json": {
              schema: z.object({ data: UndoInvoicePaymentOutputSchema, error: z.null() }),
            },
          },
        },
        404: {
          description: "Invoice payment not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { cardId, period, paymentId } = c.req.valid("param");
      return c.json(ok(await service.undo(cardId, period, paymentId, c.get("userId"))), 200);
    },
  );
  return route;
}
