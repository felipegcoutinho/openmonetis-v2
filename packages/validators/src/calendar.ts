import { z } from "@hono/zod-openapi";
import { nationalHolidayIds } from "@openmonetis/domain/business-calendars";
import { calendarEntryStatuses } from "@openmonetis/domain/calendar";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);

export const CalendarQuerySchema = z.object({
  period: periodSchema.openapi({ param: { name: "period", in: "query" }, example: "2026-11" }),
});

const CalendarEntryBaseSchema = z.object({
  id: z.string(),
  date: z.iso.date(),
  title: z.string(),
  status: z.enum(calendarEntryStatuses),
});

const PayableAmountsSchema = z.object({
  amount: z.number().nonnegative(),
  openAmount: z.number().nonnegative(),
});

export const CalendarEntrySchema = z
  .discriminatedUnion("kind", [
    CalendarEntryBaseSchema.extend(PayableAmountsSchema.shape).extend({
      kind: z.literal("bill"),
      /** Id of the payable in `GET /bills?period=` of the entry month. */
      billId: z.string(),
      detail: z.string().nullable(),
      /** Category icon name, the fallback when the establishment has no logo. */
      categoryIcon: z.string().nullable(),
    }),
    CalendarEntryBaseSchema.extend(PayableAmountsSchema.shape).extend({
      kind: z.enum(["invoiceDue", "invoiceClosing"]),
      cardId: z.uuid(),
      invoicePeriod: periodSchema,
      logo: z.string().nullable(),
    }),
    CalendarEntryBaseSchema.extend({
      kind: z.literal("task"),
      noteId: z.uuid(),
      amount: z.null(),
      openAmount: z.literal(0),
    }),
  ])
  .openapi("CalendarEntry");

export const CalendarHolidaySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("national"), id: z.enum(nationalHolidayIds) }),
  z.object({ kind: z.literal("custom") }),
]);

export const CalendarDaySchema = z
  .object({
    date: z.iso.date(),
    isToday: z.boolean(),
    isBusinessDay: z.boolean(),
    holiday: CalendarHolidaySchema.nullable(),
    openAmount: z.number().nonnegative(),
    entries: z.array(CalendarEntrySchema),
  })
  .openapi("CalendarDay");

export const CalendarOutputSchema = z
  .object({
    period: periodSchema,
    summary: z.object({
      openAmount: z.number().nonnegative(),
      paidAmount: z.number().nonnegative(),
      overdueCount: z.number().int().nonnegative(),
      entryCount: z.number().int().nonnegative(),
    }),
    days: z.array(CalendarDaySchema),
  })
  .openapi("Calendar");

export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;
export type CalendarEntryOutput = z.infer<typeof CalendarEntrySchema>;
export type CalendarDayOutput = z.infer<typeof CalendarDaySchema>;
export type CalendarOutput = z.infer<typeof CalendarOutputSchema>;
