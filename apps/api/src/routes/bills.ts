import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  BillPaymentParamsSchema,
  CreateBillPaymentInputSchema,
  DashboardBillsOutputSchema,
  ListBillsQuerySchema,
} from "@openmonetis/validators/bills";
import type { BillsService } from "../services/bills.service";
import type { ApiVariables } from "../types/context";
import { errorResponse as error, validationHook } from "../utils/openapi";

export function createBillsRoute(service: BillsService) {
  const route = new OpenAPIHono<{ Variables: ApiVariables }>({ defaultHook: validationHook });
  route.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Bills"],
      request: { query: ListBillsQuerySchema },
      responses: {
        200: {
          description: "Bills dashboard snapshot",
          content: {
            "application/json": {
              schema: z.object({ data: DashboardBillsOutputSchema, error: z.null() }),
            },
          },
        },
        401: error("Authentication required"),
      },
    }),
    async (context) =>
      context.json(
        ok(await service.get(context.req.valid("query").period, context.get("userId"))),
        200,
      ),
  );
  route.openapi(
    createRoute({
      method: "post",
      path: "/{period}/payments",
      tags: ["Bills"],
      request: {
        params: BillPaymentParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreateBillPaymentInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Bill payment registered",
          content: {
            "application/json": {
              schema: z.object({
                data: z.object({
                  id: z.string(),
                  accountId: z.uuid(),
                  paidAt: z.iso.date(),
                }),
                error: z.null(),
              }),
            },
          },
        },
        400: error("Invalid bill payment"),
        404: error("Bill or account not found"),
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.pay(
            context.req.valid("param").period,
            context.req.valid("json"),
            context.get("userId"),
          ),
        ),
        201,
      ),
  );
  return route;
}
