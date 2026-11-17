import type { CalendarOutput } from "@openmonetis/validators/calendar";
import { requestApiWithResponseMessage as request } from "@/lib/api-client";

export function getCalendar(period: string) {
  return request<CalendarOutput>(`/calendar?period=${encodeURIComponent(period)}`);
}
