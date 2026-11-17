import { queryOptions } from "@tanstack/react-query";
import { getCalendar } from "./calendar.api";

export const calendarKeys = {
  all: ["calendar"] as const,
  period: (period: string) => [...calendarKeys.all, period] as const,
};

export function calendarQueryOptions(period: string) {
  return queryOptions({
    queryKey: calendarKeys.period(period),
    queryFn: () => getCalendar(period),
  });
}
