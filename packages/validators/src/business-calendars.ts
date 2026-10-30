import { z } from "@hono/zod-openapi";
import { recurringHolidayMaximumCount } from "@openmonetis/domain/business-calendars";

const MonthDaySchema = z
  .string()
  .regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/)
  .refine((value) => {
    // 2024 is a leap year, so 02-29 stays valid while 02-30 or 04-31 are rejected.
    const date = new Date(`2024-${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(5, 10) === value;
  });
export const BusinessCalendarSchema = z
  .object({
    workingWeekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1)
      .max(7)
      .refine((days) => new Set(days).size === days.length),
    includeNationalHolidays: z.boolean(),
    holidays: z
      .array(z.iso.date())
      .max(366)
      .refine((dates) => new Set(dates).size === dates.length),
    recurringHolidays: z
      .array(MonthDaySchema)
      .max(recurringHolidayMaximumCount)
      .refine((dates) => new Set(dates).size === dates.length)
      .default([]),
  })
  .strict();
