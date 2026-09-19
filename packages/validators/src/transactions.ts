import { z } from "@hono/zod-openapi";
import {
  paymentMethods,
  recurrenceFrequencies,
  transactionConditions,
  transactionOrigins,
  transactionTypes,
  validateTransactionSplits,
} from "@openmonetis/domain/transactions";

export { paymentMethods, recurrenceFrequencies, transactionConditions, transactionTypes };

const dateSchema = z.iso.date();
const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const nullableUuidSchema = z.string().uuid().nullable().optional();
const csvUuidSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (!value) return [];

    const values = value.split(",").filter(Boolean);
    for (const item of values) {
      if (!z.uuid().safeParse(item).success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Expected a comma-separated UUID list",
        });
        return z.NEVER;
      }
    }
    return [...new Set(values)];
  });

const TransactionFieldsSchema = z.object({
  type: z.enum(transactionTypes).openapi({ example: "expense" }),
  condition: z.enum(transactionConditions).default("single").openapi({ example: "single" }),
  paymentMethod: z.enum(paymentMethods).openapi({ example: "pix" }),
  name: z.string().trim().min(1).max(160).openapi({ example: "Aluguel" }),
  amount: z.number().positive().max(999_999_999.99).openapi({ example: 2500 }),
  purchaseDate: dateSchema.openapi({ example: "2026-07-07" }),
  invoicePeriod: periodSchema.nullable().optional().openapi({ example: "2026-08" }),
  personId: z.string().uuid().openapi({ example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de" }),
  accountId: nullableUuidSchema.openapi({ example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de" }),
  cardId: nullableUuidSchema.openapi({ example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de" }),
  categoryId: nullableUuidSchema.openapi({
    example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de",
  }),
  sourceAccountId: nullableUuidSchema.openapi({
    example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de",
  }),
  destinationAccountId: nullableUuidSchema.openapi({
    example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de",
  }),
  dueDate: dateSchema.nullable().optional().openapi({ example: "2026-07-10" }),
  boletoPaymentDate: dateSchema.nullable().optional().openapi({ example: "2026-07-09" }),
  installmentCount: z.number().int().min(2).max(60).nullable().optional().openapi({ example: 12 }),
  recurrenceFrequency: z
    .enum(recurrenceFrequencies)
    .nullable()
    .optional()
    .openapi({ example: "monthly" }),
  isSettled: z.boolean().nullable().optional().openapi({ example: true }),
  note: z.string().trim().max(1000).nullable().optional().openapi({
    example: "Contrato residencial",
  }),
  splitShares: z
    .array(z.object({ personId: z.string().uuid(), amount: z.number().positive() }))
    .min(2)
    .max(50)
    .nullable()
    .optional(),
});

const CreateTransactionFieldsSchema = TransactionFieldsSchema.extend({
  startInstallment: z.number().int().min(1).max(60).optional().openapi({ example: 5 }),
});

export const TransactionInputSchema = CreateTransactionFieldsSchema.superRefine((data, ctx) => {
  if (data.splitShares) {
    if (data.type === "transfer") {
      ctx.addIssue({
        code: "custom",
        path: ["splitShares"],
        message: "Transfers cannot be split between people",
      });
    } else if (!validateTransactionSplits(data.amount, data.splitShares)) {
      ctx.addIssue({
        code: "custom",
        path: ["splitShares"],
        message: "Split people must be unique and sum to the total",
      });
    }
  }

  if (data.condition === "installment" && !data.installmentCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installmentCount"],
      message: "Installment transactions require installmentCount",
    });
  }

  if (data.condition !== "installment" && data.installmentCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["installmentCount"],
      message: "installmentCount is only allowed for installment transactions",
    });
  }

  if (
    data.condition === "installment" &&
    data.startInstallment !== undefined &&
    data.installmentCount !== null &&
    data.installmentCount !== undefined &&
    data.startInstallment > data.installmentCount
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startInstallment"],
      message: "startInstallment cannot exceed installmentCount",
    });
  }

  if (data.condition !== "installment" && data.startInstallment !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["startInstallment"],
      message: "startInstallment is only allowed for installment transactions",
    });
  }

  if (data.condition === "recurring" && !data.recurrenceFrequency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recurrenceFrequency"],
      message: "Recurring transactions require recurrenceFrequency",
    });
  }

  if (data.condition !== "recurring" && data.recurrenceFrequency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recurrenceFrequency"],
      message: "recurrenceFrequency is only allowed for recurring transactions",
    });
  }

  if (
    data.invoicePeriod &&
    (data.paymentMethod !== "credit_card" || data.condition === "recurring")
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["invoicePeriod"],
      message: "invoicePeriod is only allowed for non-recurring credit card transactions",
    });
  }

  if (
    (data.paymentMethod !== "boleto" || data.condition === "recurring") &&
    data.boletoPaymentDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["boletoPaymentDate"],
      message: "boletoPaymentDate is only allowed for non-recurring boleto transactions",
    });
  }

  if (
    data.paymentMethod === "boleto" &&
    data.condition !== "recurring" &&
    data.isSettled === true &&
    !data.boletoPaymentDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["boletoPaymentDate"],
      message: "Settled boleto transactions require boletoPaymentDate",
    });
  }

  if (
    data.paymentMethod === "boleto" &&
    data.condition !== "recurring" &&
    data.isSettled !== true &&
    data.boletoPaymentDate
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["boletoPaymentDate"],
      message: "boletoPaymentDate requires a settled boleto transaction",
    });
  }

  if (data.type === "transfer") {
    if (data.condition !== "single") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["condition"],
        message: "Transfers must use the single condition",
      });
    }

    if (data.paymentMethod !== "bank_transfer") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paymentMethod"],
        message: "Transfers must use the bank transfer payment method",
      });
    }

    if (!data.sourceAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sourceAccountId"],
        message: "Transfers require sourceAccountId",
      });
    }

    if (!data.destinationAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationAccountId"],
        message: "Transfers require destinationAccountId",
      });
    }

    if (data.sourceAccountId && data.destinationAccountId === data.sourceAccountId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["destinationAccountId"],
        message: "Transfer accounts must be different",
      });
    }

    return;
  }

  if (!data.categoryId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["categoryId"],
      message: "Income and expense transactions require categoryId",
    });
  }

  if (data.paymentMethod === "credit_card") {
    if (!data.cardId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cardId"],
        message: "Credit card transactions require cardId",
      });
    }

    return;
  }

  if (!data.accountId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["accountId"],
      message: "Non-credit transactions require accountId",
    });
  }
}).openapi("CreateTransaction");

const UpdateTransactionFieldsSchema = TransactionFieldsSchema.omit({ condition: true })
  .partial()
  .extend({ condition: z.enum(transactionConditions).optional() })
  .strict();

export const UpdateTransactionInputSchema = UpdateTransactionFieldsSchema.refine(
  (data) => Object.keys(data).length > 0,
  {
    message: "Provide at least one field to update",
  },
).openapi("UpdateTransaction");

export const TransactionParamsSchema = z
  .object({
    id: z
      .string()
      .uuid()
      .openapi({
        param: {
          name: "id",
          in: "path",
        },
        example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de",
      }),
  })
  .openapi("TransactionParams");

export const CreateTransactionRefundInputSchema = z
  .object({
    amount: z.number().positive().multipleOf(0.01).max(999_999_999.99),
    receivedAt: dateSchema,
    invoicePeriod: periodSchema.nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .openapi("CreateTransactionRefundInput");

export const TransactionRefundOutputSchema = z
  .object({
    id: z.uuid(),
    sourceTransactionId: z.uuid(),
    amount: z.number().positive(),
    remainingRefundableAmount: z.number().nonnegative(),
  })
  .openapi("TransactionRefund");

export const ListTransactionsQuerySchema = z
  .object({
    period: periodSchema.optional().openapi({
      param: {
        name: "period",
        in: "query",
      },
      example: "2026-07",
    }),
    q: z.string().trim().min(1).max(160).optional(),
    type: z.enum(transactionTypes).optional(),
    condition: z.enum(transactionConditions).optional(),
    paymentMethod: z.enum(paymentMethods).optional(),
    settlement: z.enum(["paid", "unpaid", "invoice"]).optional(),
    sort: z.enum(["recent", "oldest", "dueDate", "amount"]).optional(),
    personIds: csvUuidSchema,
    categoryIds: csvUuidSchema,
    accountIds: csvUuidSchema,
    cardIds: csvUuidSchema,
    minAmount: z.coerce.number().nonnegative().max(999_999_999.99).optional(),
    maxAmount: z.coerce.number().nonnegative().max(999_999_999.99).optional(),
    dateStart: dateSchema.optional(),
    dateEnd: dateSchema.optional(),
    hasAttachments: z
      .enum(["true"])
      .optional()
      .transform((value) => value === "true"),
    isDivided: z
      .enum(["true"])
      .optional()
      .transform((value) => value === "true"),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((value) => [5, 10, 20, 30, 40, 50, 100].includes(value))
      .default(30),
  })
  .superRefine((data, ctx) => {
    if (
      data.minAmount !== undefined &&
      data.maxAmount !== undefined &&
      data.minAmount > data.maxAmount
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["maxAmount"],
        message: "maxAmount must be greater than minAmount",
      });
    }
    if (data.dateStart && data.dateEnd && data.dateStart > data.dateEnd) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateEnd"],
        message: "dateEnd must not be before dateStart",
      });
    }
  })
  .openapi("ListTransactionsQuery");
export const transactionActionScopes = ["single", "future", "series"] as const;
export const TransactionActionScopeSchema = z.enum(transactionActionScopes);
export const TransactionActionInputSchema = z.object({
  scope: TransactionActionScopeSchema.default("single"),
});
export const TransactionActionQuerySchema =
  TransactionActionInputSchema.openapi("TransactionActionQuery");
export const BulkTransactionsInputSchema = z.object({ ids: z.array(z.uuid()).min(1).max(500) });
export const SettleTransactionsInputSchema = BulkTransactionsInputSchema.extend({
  isSettled: z.boolean(),
  settledDate: dateSchema.optional(),
});
export const RecurringRuleActionInputSchema = z.object({
  status: z.enum(["active", "paused", "cancelled"]),
});
export const SettleRecurringOccurrenceInputSchema = z.object({
  recurringRuleId: z.string().uuid(),
  purchaseDate: dateSchema,
  isSettled: z.boolean(),
  settledDate: dateSchema.optional(),
});

export const PreviewTransactionImportInputSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255),
    contentBase64: z
      .string()
      .min(1)
      .max(7_100_000)
      .regex(/^[A-Za-z0-9+/]+=*$/),
  })
  .openapi("PreviewTransactionImportInput");

export const ImportedTransactionRowSchema = z.object({
  externalId: z.string().max(255).nullable(),
  purchaseDate: dateSchema,
  amount: z.number().positive().max(999_999_999.99),
  name: z.string().trim().min(1).max(160),
  type: z.enum(["income", "expense"]),
  categoryName: z.string().trim().max(120).nullable(),
});

export const TransactionImportPreviewOutputSchema = z
  .object({
    sourceName: z.string(),
    sourceFingerprint: z.string().length(64),
    accountNumber: z.string().nullable(),
    period: z.object({ from: dateSchema, to: dateSchema }).nullable(),
    isCreditCard: z.boolean(),
    transactions: z.array(
      ImportedTransactionRowSchema.extend({
        isDuplicate: z.boolean(),
        suggestedCategoryId: z.string().uuid().nullable(),
      }),
    ),
  })
  .openapi("TransactionImportPreview");

export const ImportTransactionsInputSchema = z
  .object({
    sourceFingerprint: z
      .string()
      .length(64)
      .regex(/^[a-f0-9]+$/),
    destinationType: z.enum(["account", "card"]),
    destinationId: z.string().uuid(),
    paymentMethod: z.enum(paymentMethods),
    invoicePeriod: periodSchema.nullable().optional(),
    rows: z
      .array(
        ImportedTransactionRowSchema.pick({
          externalId: true,
          purchaseDate: true,
          amount: true,
          name: true,
          type: true,
        }).extend({
          personId: z.string().uuid(),
          categoryId: z.string().uuid(),
        }),
      )
      .min(1)
      .max(1000),
  })
  .superRefine((data, ctx) => {
    if (data.destinationType === "card" && data.paymentMethod !== "credit_card") {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "Cards require credit_card",
      });
    }
    if (data.destinationType === "account" && data.paymentMethod === "credit_card") {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "Accounts cannot use credit_card",
      });
    }
    if (data.destinationType === "card" && !data.invoicePeriod) {
      ctx.addIssue({
        code: "custom",
        path: ["invoicePeriod"],
        message: "Cards require invoicePeriod",
      });
    }
    if (data.destinationType === "account" && data.invoicePeriod) {
      ctx.addIssue({
        code: "custom",
        path: ["invoicePeriod"],
        message: "Accounts cannot use invoicePeriod",
      });
    }
  })
  .openapi("ImportTransactionsInput");

export const TransactionImportResultSchema = z
  .object({
    batchId: z.string().uuid(),
    imported: z.number().int().nonnegative(),
    skipped: z.number().int().nonnegative(),
  })
  .openapi("TransactionImportResult");

export const TransactionImportBatchParamsSchema = z.object({
  batchId: z
    .string()
    .uuid()
    .openapi({ param: { name: "batchId", in: "path" } }),
});

export const TransactionOutputSchema = z
  .object({
    id: z.string().openapi({ example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de" }),
    recordId: z.string().uuid().nullable().openapi({
      example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de",
    }),
    recurringRuleId: z.string().uuid().nullable().openapi({
      example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de",
    }),
    seriesId: z.string().uuid().nullable(),
    anticipationId: z.string().uuid().nullable(),
    isRecurring: z.boolean().openapi({ example: false }),
    type: z.enum(transactionTypes).openapi({ example: "expense" }),
    origin: z.enum(transactionOrigins),
    condition: z.enum(transactionConditions).openapi({ example: "single" }),
    paymentMethod: z.enum(paymentMethods).nullable().openapi({ example: "pix" }),
    name: z.string().openapi({ example: "Aluguel" }),
    amount: z.number().openapi({ example: -2500 }),
    displayAmount: z.number().openapi({ example: 2500 }),
    allocation: z
      .object({
        personId: z.string().uuid(),
        personName: z.string(),
        personAvatarUrl: z.string().nullable(),
        amount: z.number(),
      })
      .nullable(),
    purchaseDate: dateSchema.openapi({ example: "2026-07-07" }),
    period: periodSchema.openapi({ example: "2026-07" }),
    personId: z.string().uuid().openapi({ example: "3f6d2b84-6ed0-4a50-b257-8adf0b6178de" }),
    personName: z.string().openapi({ example: "Maria" }),
    personAvatarUrl: z.string().nullable(),
    accountId: z.string().uuid().nullable(),
    accountName: z.string().nullable(),
    accountLogo: z.string().nullable(),
    cardId: z.string().uuid().nullable(),
    cardName: z.string().nullable(),
    cardLogo: z.string().nullable(),
    invoicePaymentCardName: z.string().nullable(),
    invoicePaymentCardLogo: z.string().nullable(),
    categoryId: z.string().uuid().nullable(),
    categoryName: z.string().nullable(),
    categoryIcon: z.string().nullable(),
    sourceAccountId: z.string().uuid().nullable(),
    sourceAccountName: z.string().nullable(),
    sourceAccountLogo: z.string().nullable(),
    destinationAccountId: z.string().uuid().nullable(),
    destinationAccountName: z.string().nullable(),
    destinationAccountLogo: z.string().nullable(),
    dueDate: dateSchema.nullable(),
    boletoPaymentDate: dateSchema.nullable(),
    installmentCount: z.number().int().nullable(),
    currentInstallment: z.number().int().nullable(),
    installmentEndPeriod: periodSchema.nullable(),
    recurrenceFrequency: z.enum(recurrenceFrequencies).nullable(),
    isSettled: z.boolean().nullable(),
    note: z.string().nullable(),
    splitShares: z.array(
      z.object({
        personId: z.string().uuid(),
        personName: z.string(),
        personAvatarUrl: z.string().nullable(),
        amount: z.number(),
      }),
    ),
    isDivided: z.boolean(),
    refundSourceId: z.string().uuid().nullable(),
    refundedAmount: z.number().nonnegative(),
    refundableAmount: z.number().nonnegative(),
    hasAttachments: z.boolean(),
    createdAt: z.string().nullable().openapi({ example: "2026-07-07T12:00:00.000Z" }),
    updatedAt: z.string().nullable().openapi({ example: "2026-07-07T12:00:00.000Z" }),
  })
  .openapi("Transaction");

export const PaginatedTransactionsOutputSchema = z
  .object({
    items: z.array(TransactionOutputSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
  })
  .openapi("PaginatedTransactions");

export const RecentEstablishmentsOutputSchema = z
  .object({
    items: z.array(z.string().trim().min(1).max(160)).max(100),
  })
  .openapi("RecentEstablishments");

export type TransactionInput = z.infer<typeof TransactionInputSchema>;
export type UpdateTransactionInput = z.infer<typeof UpdateTransactionInputSchema>;
export type ListTransactionsQuery = z.infer<typeof ListTransactionsQuerySchema>;
export type TransactionOutput = z.infer<typeof TransactionOutputSchema>;
export type PaginatedTransactionsOutput = z.infer<typeof PaginatedTransactionsOutputSchema>;
export type RecentEstablishmentsOutput = z.infer<typeof RecentEstablishmentsOutputSchema>;
export type PreviewTransactionImportInput = z.infer<typeof PreviewTransactionImportInputSchema>;
export type TransactionImportPreview = z.infer<typeof TransactionImportPreviewOutputSchema>;
export type ImportTransactionsInput = z.infer<typeof ImportTransactionsInputSchema>;
export type TransactionImportResult = z.infer<typeof TransactionImportResultSchema>;
export type CreateTransactionRefundInput = z.infer<typeof CreateTransactionRefundInputSchema>;
export type TransactionRefundOutput = z.infer<typeof TransactionRefundOutputSchema>;
export type TransactionActionScope = z.infer<typeof TransactionActionScopeSchema>;
