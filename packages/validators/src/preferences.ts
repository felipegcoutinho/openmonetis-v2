import { z } from "@hono/zod-openapi";
import {
  applicationThemes,
  notificationDueSoonDayOptions,
  transactionPageSizeOptions,
} from "@openmonetis/domain/preferences";
import { paymentMethods } from "@openmonetis/domain/transactions";

const NotificationDueSoonDaysSchema = z.union(
  notificationDueSoonDayOptions.map((days) => z.literal(days)) as [
    z.ZodLiteral<1>,
    z.ZodLiteral<3>,
    z.ZodLiteral<5>,
    z.ZodLiteral<7>,
  ],
);

const TransactionsPageSizeSchema = z.union(
  transactionPageSizeOptions.map((size) => z.literal(size)) as [
    z.ZodLiteral<20>,
    z.ZodLiteral<30>,
    z.ZodLiteral<50>,
  ],
);

export const UserPreferencesOutputSchema = z
  .object({
    theme: z.enum(applicationThemes),
    hideValuesOnStart: z.boolean(),
    defaultPaymentMethod: z.enum(paymentMethods),
    defaultAccountId: z.uuid().nullable(),
    defaultCardId: z.uuid().nullable(),
    notificationDueSoonDays: NotificationDueSoonDaysSchema,
    transactionsPageSize: TransactionsPageSizeSchema,
  })
  .openapi("UserPreferencesOutput");

export const UpdateUserPreferencesInputSchema = UserPreferencesOutputSchema.partial()
  .strict()
  .refine((input) => Object.keys(input).length > 0, "Provide at least one preference to update")
  .openapi("UpdateUserPreferencesInput");

export type UserPreferencesOutput = z.infer<typeof UserPreferencesOutputSchema>;
export type UpdateUserPreferencesInput = z.infer<typeof UpdateUserPreferencesInputSchema>;
