export const BRAZIL_TIME_ZONE = "America/Sao_Paulo";

const calendarPeriodPattern = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;

type BrazilDateParts = {
  day: string;
  hour: number;
  month: string;
  year: string;
};

const brazilDatePartsFormatter = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
  month: "2-digit",
  timeZone: BRAZIL_TIME_ZONE,
  year: "numeric",
});

export function getBrazilDateParts(date: Date = new Date()): BrazilDateParts {
  const parts = new Map(
    brazilDatePartsFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    day: parts.get("day") as string,
    hour: Number(parts.get("hour")),
    month: parts.get("month") as string,
    year: parts.get("year") as string,
  };
}

export function getCurrentDateInBrazil(date: Date = new Date()) {
  const { day, month, year } = getBrazilDateParts(date);
  return `${year}-${month}-${day}`;
}

export function getCurrentPeriodInBrazil(date: Date = new Date()) {
  const { month, year } = getBrazilDateParts(date);
  return `${year}-${month}`;
}

export function getCurrentYearInBrazil(date: Date = new Date()) {
  return Number(getBrazilDateParts(date).year);
}

export function getCurrentHourInBrazil(date: Date = new Date()) {
  return getBrazilDateParts(date).hour;
}

export function formatDateInBrazil(
  date: Date,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
  locale = "pt-BR",
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: BRAZIL_TIME_ZONE,
  }).format(date);
}

export function formatDateToPartsInBrazil(
  date: Date,
  options: Omit<Intl.DateTimeFormatOptions, "timeZone">,
  locale = "pt-BR",
) {
  return new Intl.DateTimeFormat(locale, {
    ...options,
    timeZone: BRAZIL_TIME_ZONE,
  }).formatToParts(date);
}

/**
 * Converts a calendar-only value to a safe instant for presentation.
 * 15:00 UTC represents midday in Brasilia's current UTC-03:00 offset and avoids day boundaries.
 */
export function dateOnlyToSafeInstant(value: string) {
  return new Date(`${value}T15:00:00.000Z`);
}

export function periodToSafeInstant(period: string) {
  return dateOnlyToSafeInstant(`${period}-01`);
}

export function isCalendarPeriod(value: unknown): value is string {
  return typeof value === "string" && calendarPeriodPattern.test(value);
}

export function differenceInCalendarDaysFromTodayInBrazil(date: string, now: Date = new Date()) {
  const millisecondsPerDay = 86_400_000;
  const target = dateOnlyToSafeInstant(date);
  const today = dateOnlyToSafeInstant(getCurrentDateInBrazil(now));
  return Math.round((target.getTime() - today.getTime()) / millisecondsPerDay);
}
