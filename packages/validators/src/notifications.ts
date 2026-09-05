import { z } from "@hono/zod-openapi";
import { notificationSeverities } from "@openmonetis/domain/notifications";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const notificationKeySchema = z.string().trim().min(1).max(220);

const NotificationStateOutputSchema = z.object({
  notificationKey: notificationKeySchema,
  fingerprint: z.string().min(1).max(180),
  severity: z.enum(notificationSeverities),
  canArchive: z.boolean(),
  isRead: z.boolean(),
  isArchived: z.boolean(),
  readAt: z.iso.datetime().nullable(),
  archivedAt: z.iso.datetime().nullable(),
});

export const BillNotificationOutputSchema = NotificationStateOutputSchema.extend({
  kind: z.literal("bill"),
  billId: z.string().min(1),
  name: z.string(),
  amount: z.number().nonnegative(),
  dueDate: z.iso.date(),
  period: periodSchema,
  status: z.enum(["overdue", "dueSoon"]),
});

export const InvoiceNotificationOutputSchema = NotificationStateOutputSchema.extend({
  kind: z.literal("invoice"),
  cardId: z.uuid(),
  cardName: z.string(),
  cardLogo: z.string().nullable(),
  remainingAmount: z.number().nonnegative(),
  dueDate: z.iso.date(),
  period: periodSchema,
  status: z.enum(["overdue", "dueSoon"]),
});

export const BudgetNotificationOutputSchema = NotificationStateOutputSchema.extend({
  kind: z.literal("budget"),
  budgetId: z.uuid(),
  categoryName: z.string(),
  categoryIcon: z.string().nullable(),
  budgetAmount: z.number().nonnegative(),
  committedAmount: z.number().nonnegative(),
  usagePercentage: z.number().nonnegative(),
  period: periodSchema,
  status: z.enum(["warning", "reached", "exceeded"]),
});

export const InboxNotificationOutputSchema = NotificationStateOutputSchema.extend({
  kind: z.literal("inbox"),
  pendingCount: z.number().int().positive(),
  latestItemAt: z.iso.datetime(),
});

export const ExternalExpensesNotificationOutputSchema = NotificationStateOutputSchema.extend({
  kind: z.literal("externalExpenses"),
  pendingCount: z.number().int().positive(),
  totalAmount: z.number().positive(),
  counterpartCount: z.number().int().positive(),
  latestCounterpartName: z.string(),
  period: periodSchema,
  latestUpdatedAt: z.iso.datetime(),
  action: z.literal("import"),
});

export const NotificationOutputSchema = z
  .discriminatedUnion("kind", [
    BillNotificationOutputSchema,
    InvoiceNotificationOutputSchema,
    BudgetNotificationOutputSchema,
    InboxNotificationOutputSchema,
    ExternalExpensesNotificationOutputSchema,
  ])
  .openapi("Notification");

export const NotificationsOutputSchema = z
  .object({
    items: z.array(NotificationOutputSchema),
    unreadCount: z.number().int().nonnegative(),
    activeCount: z.number().int().nonnegative(),
    archivedCount: z.number().int().nonnegative(),
    generatedAt: z.iso.datetime(),
  })
  .openapi("Notifications");

export const NotificationParamsSchema = z.object({
  notificationKey: notificationKeySchema.openapi({
    param: { name: "notificationKey", in: "path" },
  }),
});

export const UpdateNotificationStateInputSchema = z
  .object({
    fingerprint: z.string().min(1).max(180),
    isRead: z.boolean().optional(),
    isArchived: z.boolean().optional(),
  })
  .refine((input) => input.isRead !== undefined || input.isArchived !== undefined, {
    message: "Provide at least one notification state field",
  })
  .openapi("UpdateNotificationStateInput");

export type NotificationOutput = z.infer<typeof NotificationOutputSchema>;
export type NotificationsOutput = z.infer<typeof NotificationsOutputSchema>;
export type UpdateNotificationStateInput = z.infer<typeof UpdateNotificationStateInputSchema>;
