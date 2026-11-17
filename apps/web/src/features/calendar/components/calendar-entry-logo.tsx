import type { CalendarEntryOutput } from "@openmonetis/validators/calendar";
import { Image } from "@unpic/react";
import { CreditCard, ListTodo } from "lucide-react";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";

const sizeClassNames = { 16: "size-4", 32: "size-8" } as const;
const fallbackIconClassNames = { 16: "size-2.5", 32: "size-4" } as const;

/**
 * Identity of an entry: the establishment logo for bills (category icon as fallback), the card
 * logo for invoices and a task icon for tasks, which have no logo of their own.
 */
export function CalendarEntryLogo({
  entry,
  size,
}: {
  entry: CalendarEntryOutput;
  size: keyof typeof sizeClassNames;
}) {
  if (entry.kind === "bill") {
    return (
      <EstablishmentLogo
        categoryIcon={entry.categoryIcon}
        editable={false}
        name={entry.title}
        size={size}
      />
    );
  }

  if ((entry.kind === "invoiceDue" || entry.kind === "invoiceClosing") && entry.logo) {
    return (
      <Image
        alt=""
        className={cn(
          "shrink-0 rounded-full object-contain outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10",
          sizeClassNames[size],
        )}
        height={size}
        layout="fixed"
        src={entry.logo}
        width={size}
      />
    );
  }

  const Icon = entry.kind === "task" ? ListTodo : CreditCard;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
        sizeClassNames[size],
      )}
    >
      <Icon className={fallbackIconClassNames[size]} />
    </span>
  );
}
