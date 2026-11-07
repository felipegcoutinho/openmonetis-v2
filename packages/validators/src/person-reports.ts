import { z } from "@hono/zod-openapi";
import {
  findPersonReportScheduleRuleError,
  maximumPersonReportScheduleMonthDays,
  personReportDeliveryStatuses,
  personReportDeliveryTriggers,
  personReportScheduleFrequencies,
  personReportSchedulePeriods,
} from "@openmonetis/domain/person-reports";
import { paymentMethods } from "@openmonetis/domain/transactions";
import { PersonBalanceOutputSchema } from "./person-settlements";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

export const PersonReportParamsSchema = z
  .object({ personId: z.uuid().openapi({ param: { name: "personId", in: "path" } }) })
  .openapi("PersonReportParams");

export const PersonReportQuerySchema = z
  .object({
    period: periodSchema.openapi({ param: { name: "period", in: "query" }, example: "2026-10" }),
  })
  .openapi("PersonReportQuery");

const PersonReportLineOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  purchaseDate: z.iso.date(),
  amount: z.number().nonnegative(),
  kind: z.enum(["expense", "refund"]),
  categoryName: z.string().nullable(),
  categoryIcon: z.string().nullable(),
  currentInstallment: z.number().int().nullable(),
  installmentCount: z.number().int().nullable(),
  isRecurring: z.boolean(),
});

const PersonReportGroupOutputSchema = z.object({
  key: z.string(),
  cardId: z.uuid().nullable(),
  cardName: z.string().nullable(),
  cardLogo: z.string().nullable(),
  /** Due date of the card's invoice for the month; null for other payment methods. */
  dueDate: z.iso.date().nullable(),
  paymentMethod: z.enum(paymentMethods).nullable(),
  totalAmount: z.number(),
  lines: z.array(PersonReportLineOutputSchema),
});

const PersonReportSettlementOutputSchema = z.object({
  id: z.uuid(),
  amount: z.number().positive(),
  receivedAt: z.iso.date(),
  source: z.enum(["manual", "invoicePayment"]),
});

const PersonReportComparisonOutputSchema = z.object({
  previousPeriod: periodSchema,
  previousAmount: z.number(),
  differenceAmount: z.number(),
  changePercentage: z.number().nullable(),
});

const PersonReportCommitmentOutputSchema = z.object({
  period: periodSchema,
  totalAmount: z.number(),
  entryCount: z.number().int().nonnegative(),
  installmentCount: z.number().int().nonnegative(),
  recurringCount: z.number().int().nonnegative(),
});

export const PersonReportOutputSchema = z
  .object({
    period: periodSchema,
    person: z.object({ id: z.uuid(), name: z.string() }),
    balance: PersonBalanceOutputSchema,
    groups: z.array(PersonReportGroupOutputSchema),
    settlements: z.array(PersonReportSettlementOutputSchema),
    entryCount: z.number().int().nonnegative(),
    comparison: PersonReportComparisonOutputSchema,
    /** Coming months with expenses already recorded for the person. */
    commitments: z.array(PersonReportCommitmentOutputSchema),
  })
  .openapi("PersonReportOutput");

export const PersonReportDocumentOutputSchema = z
  .object({
    /** Also the browser's suggested file name when the page is saved as PDF. */
    title: z.string(),
    html: z.string(),
  })
  .openapi("PersonReportDocumentOutput");

export const maximumPersonReportMessageLength = 500;

export const CreatePersonReportDeliveryInputSchema = z
  .object({
    period: periodSchema,
    message: z.string().trim().max(maximumPersonReportMessageLength).nullable().optional(),
    includeSpreadsheet: z.boolean().default(false),
  })
  .openapi("CreatePersonReportDeliveryInput");

export const PersonReportDeliveryOutputSchema = z
  .object({
    id: z.uuid(),
    period: periodSchema,
    trigger: z.enum(personReportDeliveryTriggers),
    status: z.enum(personReportDeliveryStatuses),
    recipientEmail: z.string(),
    includesSpreadsheet: z.boolean(),
    /** Date of the scheduled send; null for manual deliveries. */
    scheduledFor: z.iso.date().nullable(),
    createdAt: z.iso.datetime(),
    sentAt: z.iso.datetime().nullable(),
  })
  .openapi("PersonReportDeliveryOutput");

export const PersonReportDeliveriesOutputSchema = z
  .object({
    emailEnabled: z.boolean(),
    deliveries: z.array(PersonReportDeliveryOutputSchema),
  })
  .openapi("PersonReportDeliveriesOutput");

const scheduleRuleFields = {
  frequency: z.enum(personReportScheduleFrequencies).openapi({ example: "monthly" }),
  weekday: z.number().int().min(0).max(6).nullable().openapi({ example: null }),
  monthDays: z
    .array(z.number().int().min(1).max(31))
    .max(maximumPersonReportScheduleMonthDays)
    .openapi({ example: [1] }),
  reportPeriod: z.enum(personReportSchedulePeriods).openapi({ example: "previous" }),
  includeSpreadsheet: z.boolean(),
};

export const UpdatePersonReportScheduleInputSchema = z
  .object({ enabled: z.boolean(), ...scheduleRuleFields })
  .superRefine((value, context) => {
    const error = findPersonReportScheduleRuleError(value);
    if (error) {
      context.addIssue({
        code: "custom",
        message: error,
        path: [value.frequency === "weekly" ? "weekday" : "monthDays"],
      });
    }
  })
  .openapi("UpdatePersonReportScheduleInput");

export const PersonReportScheduleOutputSchema = z
  .object({ enabled: z.boolean(), ...scheduleRuleFields, updatedAt: z.iso.datetime() })
  .openapi("PersonReportScheduleOutput");

export const PersonReportScheduleStateOutputSchema = z
  .object({
    emailEnabled: z.boolean(),
    /** Hour, Brasília time, from which scheduled reports are sent. */
    sendingHour: z.number().int().min(0).max(23),
    schedule: PersonReportScheduleOutputSchema.nullable(),
    nextDeliveryDates: z.array(z.iso.date()),
  })
  .openapi("PersonReportScheduleStateOutput");

export type PersonReportQuery = z.infer<typeof PersonReportQuerySchema>;
export type PersonReportOutput = z.infer<typeof PersonReportOutputSchema>;
export type PersonReportGroupOutput = PersonReportOutput["groups"][number];
export type PersonReportLineOutput = PersonReportGroupOutput["lines"][number];
export type PersonReportComparisonOutput = PersonReportOutput["comparison"];
export type PersonReportCommitmentOutput = PersonReportOutput["commitments"][number];
export type CreatePersonReportDeliveryInput = z.input<typeof CreatePersonReportDeliveryInputSchema>;
export type PersonReportDeliveryOutput = z.infer<typeof PersonReportDeliveryOutputSchema>;
export type PersonReportDeliveriesOutput = z.infer<typeof PersonReportDeliveriesOutputSchema>;
export type UpdatePersonReportScheduleInput = z.infer<typeof UpdatePersonReportScheduleInputSchema>;
export type PersonReportScheduleOutput = z.infer<typeof PersonReportScheduleOutputSchema>;
export type PersonReportScheduleStateOutput = z.infer<typeof PersonReportScheduleStateOutputSchema>;
export type PersonReportDocumentOutput = z.infer<typeof PersonReportDocumentOutputSchema>;
