import type { CalendarEntryOutput } from "@openmonetis/validators/calendar";
import { CircleAlert, CircleCheck, Clock, Lock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One icon and color per status, so status never depends on color alone. */
const calendarStatusIcons: Record<
  CalendarEntryOutput["status"],
  { icon: LucideIcon; className: string }
> = {
  overdue: { icon: CircleAlert, className: "text-destructive" },
  pending: { icon: Clock, className: "text-warning" },
  done: { icon: CircleCheck, className: "text-success" },
  info: { icon: Lock, className: "text-muted-foreground" },
};

export function CalendarStatusIcon({
  status,
  className,
}: {
  status: CalendarEntryOutput["status"];
  className?: string;
}) {
  const { icon: Icon, className: colorClassName } = calendarStatusIcons[status];
  return <Icon aria-hidden="true" className={cn("size-3.5 shrink-0", colorClassName, className)} />;
}
