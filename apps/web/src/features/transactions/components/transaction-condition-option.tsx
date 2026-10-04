import { CalendarClock, Check, Repeat2 } from "lucide-react";

import { transactionConditionLabels } from "../transactions.presentation";

import type { TransactionFormValues } from "./transaction-form.validation";

export function TransactionConditionOption({
  condition,
}: {
  condition: TransactionFormValues["condition"];
}) {
  const Icon =
    condition === "recurring" ? Repeat2 : condition === "installment" ? CalendarClock : Check;

  return (
    <span className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span>{transactionConditionLabels[condition]}</span>
    </span>
  );
}
