import type { TransactionInput } from "@openmonetis/validators/transactions";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { transactionTypeLabels } from "../transactions.presentation";

type TransactionType = TransactionInput["type"];

const transactionTypeBadgeStyles: Record<TransactionType, string> = {
  income: "border-success/80 bg-success/5",
  expense: "border-destructive/80 bg-destructive/5",
  transfer: "border-info/80 bg-info/5",
};

export const transactionTypeIconStyles: Record<TransactionType, string> = {
  income: "text-success",
  expense: "text-destructive",
  transfer: "text-info",
};

const transactionTypeBadgeLabels: Record<TransactionType, string> = {
  ...transactionTypeLabels,
  transfer: "Transf.",
};

export const transactionTypeIcons = {
  income: ArrowDownLeft,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
} satisfies Record<TransactionType, typeof ArrowDownLeft>;

type TransactionTypeBadgeProps = {
  className?: string;
  label?: string;
  type: TransactionType;
};

export function TransactionTypeBadge({ className, label, type }: TransactionTypeBadgeProps) {
  const Icon = transactionTypeIcons[type];

  return (
    <Badge
      className={cn(
        "h-6 gap-1.5 rounded-sm! px-2",
        transactionTypeBadgeStyles[type],
        transactionTypeIconStyles[type],
        className,
      )}
      variant="outline"
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {label ?? transactionTypeBadgeLabels[type]}
    </Badge>
  );
}
