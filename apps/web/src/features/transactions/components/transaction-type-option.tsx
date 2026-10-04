import { cn } from "@/lib/utils";

import { transactionTypeLabels } from "../transactions.presentation";

import type { TransactionFormValues } from "./transaction-form.validation";

import { transactionTypeIconStyles, transactionTypeIcons } from "./transaction-type-badge";

export function TransactionTypeOption({ type }: { type: TransactionFormValues["type"] }) {
  const Icon = transactionTypeIcons[type];

  return (
    <span className="flex items-center gap-2">
      <Icon aria-hidden="true" className={cn("size-4", transactionTypeIconStyles[type])} />
      {transactionTypeLabels[type]}
    </span>
  );
}
