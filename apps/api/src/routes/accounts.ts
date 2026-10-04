import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  AccountBalanceAdjustmentOutputSchema,
  AccountBalanceAdjustmentPreviewSchema,
  AccountCashFlowOutputSchema,
  AccountOutputSchema,
  AccountParamsSchema,
  AccountPeriodQuerySchema,
  AddAccountYieldInputSchema,
  AdjustAccountBalanceInputSchema,
  CreateAccountInputSchema,
  ReplaceAccountInputSchema,
  UpdateAccountInputSchema,
} from "@openmonetis/validators/accounts";
import type { AccountsService } from "../services/accounts.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as ErrorSchema, validationHook } from "../utils/openapi";

const AccountResponseSchema = z.object({ data: AccountOutputSchema, error: z.null() });
const AccountCashFlowResponseSchema = z.object({
  data: AccountCashFlowOutputSchema,
  error: z.null(),
});
const AccountBalanceAdjustmentResponseSchema = z.object({
  data: AccountBalanceAdjustmentOutputSchema,
  error: z.null(),
});
const AccountsResponseSchema = z.object({ data: z.array(AccountOutputSchema), error: z.null() });
const DeletedAccountResponseSchema = z.object({
  data: z.object({ id: z.uuid() }),
  error: z.null(),
});

export function createAccountsRoute(service: AccountsService) {
  const accountsRoute = new OpenAPIHono<{ Variables: ApiVariables }>({
    defaultHook: validationHook,
  });

  accountsRoute.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Accounts"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: CreateAccountInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created account",
          content: { "application/json": { schema: AccountResponseSchema } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const account = await service.create(context.req.valid("json"), context.get("userId"));
      return context.json(ok(account), 201);
    },
  );

  accountsRoute.openapi(
    createRoute({
      method: "post",
      path: "/{id}/yields",
      tags: ["Accounts"],
      request: {
        params: AccountParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: AddAccountYieldInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Account yield added",
          content: { "application/json": { schema: AccountResponseSchema } },
        },
        400: {
          description: "Yield must increase the account balance",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.addYield(id, context.get("userId"), context.req.valid("json"))),
        200,
      );
    },
  );

  accountsRoute.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Accounts"],
      request: { query: AccountPeriodQuerySchema },
      responses: {
        200: {
          description: "List accounts",
          content: { "application/json": { schema: AccountsResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(await service.list(context.get("userId"), context.req.valid("query").period)),
        200,
      ),
  );

  accountsRoute.openapi(
    createRoute({
      method: "get",
      path: "/{id}/cash-flow",
      tags: ["Accounts"],
      request: { params: AccountParamsSchema, query: AccountPeriodQuerySchema },
      responses: {
        200: {
          description: "Daily account flow and twelve-month history",
          content: { "application/json": { schema: AccountCashFlowResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.cashFlow(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("query").period,
          ),
        ),
        200,
      ),
  );

  accountsRoute.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Accounts"],
      request: { params: AccountParamsSchema, query: AccountPeriodQuerySchema },
      responses: {
        200: {
          description: "Get account",
          content: { "application/json": { schema: AccountResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.get(id, context.get("userId"), context.req.valid("query").period)),
        200,
      );
    },
  );

  accountsRoute.openapi(
    createRoute({
      method: "put",
      path: "/{id}",
      tags: ["Accounts"],
      request: {
        params: AccountParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: ReplaceAccountInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Replaced account",
          content: { "application/json": { schema: AccountResponseSchema } },
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
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.replace(id, context.get("userId"), context.req.valid("json"))),
        200,
      );
    },
  );

  accountsRoute.openapi(
    createRoute({
      method: "post",
      path: "/{id}/balance-adjustments",
      tags: ["Accounts"],
      request: {
        params: AccountParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: AdjustAccountBalanceInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Adjusted account balance",
          content: { "application/json": { schema: AccountBalanceAdjustmentResponseSchema } },
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
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(
        ok(await service.adjustBalance(id, context.get("userId"), context.req.valid("json"))),
        200,
      );
    },
  );

  accountsRoute.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Accounts"],
      request: { params: AccountParamsSchema },
      responses: {
        200: {
          description: "Permanently deleted inactive account and its financial records",
          content: { "application/json": { schema: DeletedAccountResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
        409: {
          description: "Account must be inactive before permanent deletion",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) => {
      const { id } = context.req.valid("param");
      return context.json(ok(await service.remove(id, context.get("userId"))), 200);
    },
  );

  accountsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Accounts"],
      request: {
        params: AccountParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateAccountInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated account",
          content: { "application/json": { schema: AccountResponseSchema } },
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
          description: "Account not found",
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

  accountsRoute.openapi(
    createRoute({
      method: "post",
      path: "/{id}/balance-adjustments/preview",
      tags: ["Accounts"],
      request: {
        params: AccountParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: AdjustAccountBalanceInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Read-only balance adjustment preview",
          content: {
            "application/json": {
              schema: z.object({ data: AccountBalanceAdjustmentPreviewSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid adjustment",
          content: { "application/json": { schema: ErrorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: ErrorSchema } },
        },
        404: {
          description: "Account not found",
          content: { "application/json": { schema: ErrorSchema } },
        },
      },
    }),
    async (context) =>
      context.json(
        ok(
          await service.previewBalanceAdjustment(
            context.req.valid("param").id,
            context.get("userId"),
            context.req.valid("json"),
          ),
        ),
        200,
      ),
  );
  return accountsRoute;
}
