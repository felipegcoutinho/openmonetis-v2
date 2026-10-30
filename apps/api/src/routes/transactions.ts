import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { ok } from "@openmonetis/shared/api";
import {
  BulkCategorizeTransactionsInputSchema,
  BulkDeleteTransactionsInputSchema,
  BulkRenameTransactionsInputSchema,
  BulkTagTransactionsInputSchema,
  BulkTransactionsOutputSchema,
  CreateTransactionRefundInputSchema,
  ExportTransactionsQuerySchema,
  ImportTransactionsInputSchema,
  InstallmentOptionsOutputSchema,
  InstallmentOptionsQuerySchema,
  ListTransactionsQuerySchema,
  PaginatedTransactionsOutputSchema,
  PreviewTransactionImportInputSchema,
  RecentEstablishmentsOutputSchema,
  RecurrenceEndDateOutputSchema,
  RecurrenceEndDateQuerySchema,
  RecurringOccurrenceActionInputSchema,
  RecurringRuleActionInputSchema,
  RecurringRuleOccurrenceQuerySchema,
  SettleRecurringOccurrenceInputSchema,
  SettleTransactionsInputSchema,
  TransactionActionInputSchema,
  TransactionActionQuerySchema,
  TransactionExportOutputSchema,
  TransactionImportBatchParamsSchema,
  TransactionImportPreviewOutputSchema,
  TransactionImportResultSchema,
  TransactionInputSchema,
  TransactionOutputSchema,
  TransactionParamsSchema,
  TransactionRefundOutputSchema,
  UpdateRecurringRuleQuerySchema,
  UpdateTransactionInputSchema,
} from "@openmonetis/validators/transactions";
import type { TransactionsService } from "../services/transactions.service";
import type { ApiVariables } from "../types/context";
import { ErrorResponseSchema as errorSchema, validationHook } from "../utils/openapi";

const transactionResponseSchema = z
  .object({
    data: TransactionOutputSchema,
    error: z.null(),
  })
  .openapi("TransactionResponse");

const transactionsResponseSchema = z
  .object({
    data: PaginatedTransactionsOutputSchema,
    error: z.null(),
  })
  .openapi("TransactionsResponse");

const recentEstablishmentsResponseSchema = z
  .object({
    data: RecentEstablishmentsOutputSchema,
    error: z.null(),
  })
  .openapi("RecentEstablishmentsResponse");

const deleteTransactionResponseSchema = z
  .object({
    data: z.object({ id: z.string().uuid() }),
    error: z.null(),
  })
  .openapi("DeleteTransactionResponse");

const bulkTransactionsResponseSchema = z
  .object({
    data: BulkTransactionsOutputSchema,
    error: z.null(),
  })
  .openapi("BulkTransactionsResponse");

const bulkTransactionsErrorResponses = {
  400: {
    description: "Action is not supported for every selected transaction",
    content: { "application/json": { schema: errorSchema } },
  },
  401: {
    description: "Authentication required",
    content: { "application/json": { schema: errorSchema } },
  },
  404: {
    description: "Transaction, category or tag not found",
    content: { "application/json": { schema: errorSchema } },
  },
} as const;

const importPreviewResponseSchema = z.object({
  data: TransactionImportPreviewOutputSchema,
  error: z.null(),
});
const importResultResponseSchema = z.object({
  data: TransactionImportResultSchema,
  error: z.null(),
});

export function createTransactionsRoute(service: TransactionsService) {
  const {
    changeRecurringRuleStatus,
    applyRecurringRuleAction,
    categorizeTransactions,
    copyRecurringRule,
    copyTransaction,
    createTransaction,
    createTransactionRefund,
    deleteTransaction,
    deleteTransactions,
    generateTransactionImportTemplate,
    getTransactionById,
    getRecurringRuleOccurrence,
    importTransactions,
    listRecentEstablishments,
    listTransactions,
    previewTransactionImport,
    renameTransactions,
    settleRecurringOccurrence,
    settleTransactions,
    tagTransactions,
    undoTransactionImport,
    updateRecurringRule,
    updateTransaction,
  } = service;
  const transactionsRoute = new OpenAPIHono<{ Variables: ApiVariables }>({
    defaultHook: validationHook,
  });

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/export",
      tags: ["Transactions"],
      request: { query: ExportTransactionsQuerySchema },
      responses: {
        200: {
          description: "Export all matching transactions, preserving filters and sort order",
          content: {
            "application/json": {
              schema: z.object({ data: TransactionExportOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid export filters or format",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(ok(await service.exportTransactions(c.get("userId"), c.req.valid("query"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/installments/preview",
      tags: ["Transactions"],
      request: { query: InstallmentOptionsQuerySchema },
      responses: {
        200: {
          description: "Installment options with cent redistribution calculated by the domain",
          content: {
            "application/json": {
              schema: z.object({ data: InstallmentOptionsOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid amount",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    (context) =>
      context.json(
        ok(service.previewInstallmentOptions(context.req.valid("query"), context.get("userId"))),
        200,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/recurrence-end-date",
      tags: ["Transactions"],
      request: { query: RecurrenceEndDateQuerySchema },
      responses: {
        200: {
          description:
            "Inclusive recurrence end date that keeps the requested number of occurrences, calculated by the domain",
          content: {
            "application/json": {
              schema: z.object({ data: RecurrenceEndDateOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Invalid start date, frequency or occurrence count",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    (context) =>
      context.json(
        ok(service.previewRecurrenceEndDate(context.req.valid("query"), context.get("userId"))),
        200,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/establishments/recent",
      tags: ["Transactions"],
      responses: {
        200: {
          description: "List unique establishments used in expenses during the last two months",
          content: { "application/json": { schema: recentEstablishmentsResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => c.json(ok(await listRecentEstablishments(c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/{id}/refunds",
      tags: ["Transactions"],
      request: {
        params: TransactionParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: CreateTransactionRefundInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Refund linked to its source expense",
          content: {
            "application/json": {
              schema: z.object({ data: TransactionRefundOutputSchema, error: z.null() }),
            },
          },
        },
        400: {
          description: "Transaction is not refundable or amount is invalid",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Transaction not found",
          content: { "application/json": { schema: errorSchema } },
        },
        409: {
          description: "Transaction changed during refund",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(
        ok(
          await createTransactionRefund(
            c.req.valid("param").id,
            c.req.valid("json"),
            c.get("userId"),
          ),
        ),
        201,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/imports/template",
      tags: ["Transactions"],
      responses: {
        200: {
          description: "Spreadsheet template for transaction imports",
          content: {
            "application/json": {
              schema: z.object({
                data: z.object({ fileName: z.string(), contentBase64: z.string() }),
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
    async (c) => c.json(ok(await generateTransactionImportTemplate()), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/imports/preview",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: PreviewTransactionImportInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Parsed statement ready for review",
          content: { "application/json": { schema: importPreviewResponseSchema } },
        },
        400: {
          description: "Invalid statement",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(ok(await previewTransactionImport(c.req.valid("json"), c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/imports",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: ImportTransactionsInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Imported statement transactions",
          content: { "application/json": { schema: importResultResponseSchema } },
        },
        400: {
          description: "Invalid import",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Linked resource not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => c.json(ok(await importTransactions(c.req.valid("json"), c.get("userId"))), 201),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "delete",
      path: "/imports/{batchId}",
      tags: ["Transactions"],
      request: { params: TransactionImportBatchParamsSchema },
      responses: {
        200: {
          description: "Undid a transaction import batch",
          content: {
            "application/json": {
              schema: z.object({
                data: z.object({ batchId: z.string().uuid(), deleted: z.number().int() }),
                error: z.null(),
              }),
            },
          },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Import batch not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(ok(await undoTransactionImport(c.req.valid("param").batchId, c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/recurring-occurrences/settlement",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SettleRecurringOccurrenceInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Settled recurring occurrence",
          content: {
            "application/json": {
              schema: z.object({
                data: SettleRecurringOccurrenceInputSchema,
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Recurring rule not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(
        ok(
          await settleRecurringOccurrence(
            input.recurringRuleId,
            input.purchaseDate,
            c.get("userId"),
            input.isSettled,
            input.settledDate,
            input.settledAmount,
            input.accountId,
          ),
        ),
        200,
      );
    },
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: TransactionInputSchema } },
        },
      },
      responses: {
        201: {
          description: "Created transaction",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Linked resource not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const body = c.req.valid("json");
      const transaction = await createTransaction({ ...body, userId: c.get("userId") });

      return c.json(ok(transaction), 201);
    },
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/recurring-rules/{id}/copy",
      tags: ["Transactions"],
      request: { params: TransactionParamsSchema },
      responses: {
        201: {
          description: "Copied recurring rule",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Recurring rule not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => c.json(ok(await copyRecurringRule(c.req.valid("param").id, c.get("userId"))), 201),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/recurring-rules/{id}/occurrence",
      tags: ["Transactions"],
      request: { params: TransactionParamsSchema, query: RecurringRuleOccurrenceQuerySchema },
      responses: {
        200: {
          description: "Recurring occurrence with full editable fields",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        400: {
          description: "Invalid recurring occurrence",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Recurring rule not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(
        ok(
          await getRecurringRuleOccurrence(
            c.req.valid("param").id,
            c.req.valid("query").occurrenceDate,
            c.get("userId"),
          ),
        ),
        200,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "put",
      path: "/recurring-rules/{id}",
      tags: ["Transactions"],
      request: {
        params: TransactionParamsSchema,
        query: UpdateRecurringRuleQuerySchema,
        body: {
          required: true,
          content: { "application/json": { schema: TransactionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated recurring rule",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: errorSchema } },
        },
        409: {
          description: "Recurring rule changed during editing",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Recurring rule not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(
        ok(
          await updateRecurringRule(
            c.req.valid("param").id,
            c.get("userId"),
            c.req.valid("json"),
            c.req.valid("query"),
          ),
        ),
        200,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/settlement",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: SettleTransactionsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Settled transactions",
          content: {
            "application/json": {
              schema: z.object({
                data: z.object({ ids: z.array(z.uuid()), isSettled: z.boolean() }),
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Transaction not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const input = c.req.valid("json");
      return c.json(
        ok(
          await settleTransactions(
            input.ids,
            c.get("userId"),
            input.isSettled,
            input.settledDate,
            input.settledAmount,
            input.accountId,
          ),
        ),
        200,
      );
    },
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/bulk/category",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BulkCategorizeTransactionsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Categorized transactions",
          content: { "application/json": { schema: bulkTransactionsResponseSchema } },
        },
        ...bulkTransactionsErrorResponses,
      },
    }),
    async (c) =>
      c.json(ok(await categorizeTransactions(c.req.valid("json"), c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/bulk/names",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BulkRenameTransactionsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Renamed transactions",
          content: { "application/json": { schema: bulkTransactionsResponseSchema } },
        },
        ...bulkTransactionsErrorResponses,
      },
    }),
    async (c) => c.json(ok(await renameTransactions(c.req.valid("json"), c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/bulk/tags",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BulkTagTransactionsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Tagged transactions",
          content: { "application/json": { schema: bulkTransactionsResponseSchema } },
        },
        ...bulkTransactionsErrorResponses,
      },
    }),
    async (c) => c.json(ok(await tagTransactions(c.req.valid("json"), c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/bulk/delete",
      tags: ["Transactions"],
      request: {
        body: {
          required: true,
          content: { "application/json": { schema: BulkDeleteTransactionsInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Deleted transactions",
          content: { "application/json": { schema: bulkTransactionsResponseSchema } },
        },
        ...bulkTransactionsErrorResponses,
      },
    }),
    async (c) => c.json(ok(await deleteTransactions(c.req.valid("json"), c.get("userId"))), 200),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/{id}",
      tags: ["Transactions"],
      request: { params: TransactionParamsSchema },
      responses: {
        200: {
          description: "Get transaction by id",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Transaction not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const transaction = await getTransactionById(id, c.get("userId"));

      return c.json(ok(transaction), 200);
    },
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/{id}",
      tags: ["Transactions"],
      request: {
        params: TransactionParamsSchema,
        query: TransactionActionQuerySchema,
        body: {
          required: true,
          content: { "application/json": { schema: UpdateTransactionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Update transaction",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Transaction not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const { scope } = c.req.valid("query");
      const body = c.req.valid("json");
      const transaction = await updateTransaction(id, c.get("userId"), body, scope);

      return c.json(ok(transaction), 200);
    },
  );

  transactionsRoute.openapi(
    createRoute({
      method: "delete",
      path: "/{id}",
      tags: ["Transactions"],
      request: {
        params: TransactionParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: TransactionActionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Delete transaction",
          content: { "application/json": { schema: deleteTransactionResponseSchema } },
        },
        400: {
          description: "Transaction must be removed through its owning workflow",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Transaction not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const transaction = await deleteTransaction(id, c.get("userId"), body?.scope);

      return c.json(ok(transaction), 200);
    },
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/{id}/copy",
      tags: ["Transactions"],
      request: { params: TransactionParamsSchema },
      responses: {
        201: {
          description: "Copied transaction",
          content: { "application/json": { schema: transactionResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Transaction not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => c.json(ok(await copyTransaction(c.req.valid("param").id, c.get("userId"))), 201),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "patch",
      path: "/recurring-rules/{id}/status",
      tags: ["Transactions"],
      request: {
        params: TransactionParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: RecurringRuleActionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Updated recurring rule",
          content: {
            "application/json": {
              schema: z.object({
                data: z.object({ id: z.uuid(), status: z.enum(["active", "paused", "cancelled"]) }),
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Invalid request",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Recurring rule not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(
        ok(
          await changeRecurringRuleStatus(
            c.req.valid("param").id,
            c.get("userId"),
            c.req.valid("json").status,
            c.req.valid("json").occurrenceDate,
          ),
        ),
        200,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "post",
      path: "/recurring-rules/{id}/actions",
      tags: ["Transactions"],
      request: {
        params: TransactionParamsSchema,
        body: {
          required: true,
          content: { "application/json": { schema: RecurringOccurrenceActionInputSchema } },
        },
      },
      responses: {
        200: {
          description: "Applied recurring action, preserving earlier occurrences",
          content: {
            "application/json": {
              schema: z.object({
                data: RecurringOccurrenceActionInputSchema.extend({ id: z.uuid() }),
                error: z.null(),
              }),
            },
          },
        },
        400: {
          description: "Invalid action or occurrence",
          content: { "application/json": { schema: errorSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
        404: {
          description: "Recurring rule not found",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) =>
      c.json(
        ok(
          await applyRecurringRuleAction(
            c.req.valid("param").id,
            c.get("userId"),
            c.req.valid("json"),
          ),
        ),
        200,
      ),
  );

  transactionsRoute.openapi(
    createRoute({
      method: "get",
      path: "/",
      tags: ["Transactions"],
      request: { query: ListTransactionsQuerySchema },
      responses: {
        200: {
          description: "List transactions with filters and pagination",
          content: { "application/json": { schema: transactionsResponseSchema } },
        },
        401: {
          description: "Authentication required",
          content: { "application/json": { schema: errorSchema } },
        },
      },
    }),
    async (c) => {
      const query = c.req.valid("query");
      const transactions = await listTransactions(c.get("userId"), query);

      return c.json(ok(transactions), 200);
    },
  );

  return transactionsRoute;
}
