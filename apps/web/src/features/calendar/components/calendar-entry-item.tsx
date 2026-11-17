import type { CalendarEntryOutput } from "@openmonetis/validators/calendar";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  describeCalendarEntry,
  getCalendarEntryAmountCaption,
  getCalendarEntryStatusLabel,
} from "../calendar.presentation";
import { CalendarEntryLogo } from "./calendar-entry-logo";
import { CalendarStatusIcon } from "./calendar-status-icon";

const statusClassNames: Record<CalendarEntryOutput["status"], string> = {
  overdue: "text-destructive",
  pending: "text-muted-foreground",
  done: "text-success",
  info: "",
};

/** Covers the whole row with the entry's link, so the row itself is the click target. */
const rowLinkClassName =
  "outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:ring-2 focus-visible:after:ring-ring focus-visible:after:ring-inset";

/**
 * One row of a day's agenda. The parent list is a grid whose columns (logo, text, amount and
 * action) every row shares through `subgrid`, so amounts and actions stay aligned across rows.
 */
export function CalendarEntryItem({
  entry,
  onPayBill,
}: {
  entry: CalendarEntryOutput;
  onPayBill: (billId: string) => void;
}) {
  const statusLabel = getCalendarEntryStatusLabel(entry);
  const isDone = entry.status === "done";
  const isNavigable = entry.kind !== "bill";
  const amountCaption = getCalendarEntryAmountCaption(entry);

  return (
    <li
      className={cn(
        "relative col-span-4 grid grid-cols-subgrid items-center gap-x-3 px-3 py-3",
        isNavigable && "transition-colors duration-150 ease-out hover:bg-muted/50",
      )}
    >
      <CalendarEntryLogo entry={entry} size={32} />
      <div className="min-w-0">
        <p
          className={cn(
            "line-clamp-2 text-pretty break-words text-sm",
            isDone && "text-muted-foreground",
          )}
        >
          <EntryTitle entry={entry} />
        </p>
        <p className="truncate text-muted-foreground text-xs">{describeCalendarEntry(entry)}</p>
      </div>
      <div className="grid justify-items-end gap-0.5 text-right">
        {entry.amount !== null ? (
          <span className="flex items-baseline gap-1">
            {/* With a status line below, the caption ("Restante") qualifies the amount inline. */}
            {amountCaption && statusLabel ? (
              <span className="text-muted-foreground text-xs">{amountCaption}</span>
            ) : null}
            <MoneyValue
              amount={entry.kind === "invoiceDue" && !isDone ? entry.openAmount : entry.amount}
              className={cn(
                "font-medium text-sm tabular-nums",
                (isDone || entry.status === "info") && "text-muted-foreground",
              )}
            />
          </span>
        ) : null}
        {statusLabel ? (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-xs",
              statusClassNames[entry.status],
            )}
          >
            <CalendarStatusIcon className="size-3" status={entry.status} />
            {statusLabel}
          </span>
        ) : amountCaption ? (
          <span className="text-muted-foreground text-xs">{amountCaption}</span>
        ) : null}
      </div>
      <div className="flex justify-end">
        <CalendarEntryAction entry={entry} onPayBill={onPayBill} />
      </div>
    </li>
  );
}

function EntryTitle({ entry }: { entry: CalendarEntryOutput }) {
  if (entry.kind === "invoiceDue" || entry.kind === "invoiceClosing") {
    return (
      <Link
        aria-label={`Abrir fatura de ${entry.title}`}
        className={rowLinkClassName}
        params={{ cardId: entry.cardId }}
        search={{ period: entry.invoicePeriod }}
        to="/cards/$cardId"
      >
        {entry.title}
      </Link>
    );
  }
  if (entry.kind === "task") {
    return (
      <Link
        aria-label={`Abrir anotações para ${entry.title}`}
        className={rowLinkClassName}
        to="/notes"
      >
        {entry.title}
      </Link>
    );
  }
  return entry.title;
}

function CalendarEntryAction({
  entry,
  onPayBill,
}: {
  entry: CalendarEntryOutput;
  onPayBill: (billId: string) => void;
}) {
  if (entry.kind !== "bill") {
    return <ChevronRight aria-hidden="true" className="size-4 text-muted-foreground" />;
  }
  if (entry.status === "done") return null;
  return (
    <Button
      aria-label={`Pagar ${entry.title}`}
      className="relative"
      onClick={() => onPayBill(entry.billId)}
      size="sm"
      type="button"
      variant="outline"
    >
      Pagar
    </Button>
  );
}
