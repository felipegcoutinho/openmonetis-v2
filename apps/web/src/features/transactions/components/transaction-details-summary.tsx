import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { Circle, CircleCheck, CreditCard } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  formatTransactionConditionSummary,
  formatTransactionSettlementSummary,
  transactionTypeLabels,
} from "../transactions.presentation";
import { transactionTypeIconStyles, transactionTypeIcons } from "./transaction-type-badge";

const amountStyles: Record<TransactionOutput["type"], string> = {
  income: "text-success",
  expense: "text-foreground",
  transfer: "text-info",
};

export function TransactionSummary({ transaction }: { transaction: TransactionOutput }) {
  const TypeIcon = transactionTypeIcons[transaction.type];
  const settlement =
    transaction.paymentMethod === "credit_card" || transaction.isSettled === null
      ? { icon: CreditCard, className: "bg-secondary text-secondary-foreground" }
      : transaction.isSettled
        ? { icon: CircleCheck, className: "bg-success/10 text-success" }
        : { icon: Circle, className: "bg-warning/15 text-foreground" };
  const SettlementIcon = settlement.icon;

  return (
    <section
      aria-label="Resumo do lançamento"
      className="grid min-w-0 justify-items-center gap-3 pb-3 text-center sm:justify-items-start sm:rounded-xl sm:border sm:bg-muted/30 sm:p-4 sm:text-left"
    >
      <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
        <TypeIcon
          aria-hidden="true"
          className={cn("size-4 shrink-0", transactionTypeIconStyles[transaction.type])}
        />
        <span className="font-medium text-foreground">
          {transactionTypeLabels[transaction.type]}
        </span>
        <span aria-hidden="true">·</span>
        <span>{formatTransactionConditionSummary(transaction)}</span>
      </p>
      <MoneyValue
        amount={transaction.amount}
        className={cn(
          "block max-w-full break-all font-semibold text-3xl tracking-tight tabular-nums",
          amountStyles[transaction.type],
        )}
        showPositiveSign={transaction.type === "income"}
      />
      <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
        <Badge className={settlement.className} variant="secondary">
          <SettlementIcon aria-hidden="true" />
          {formatTransactionSettlementSummary(transaction)}
        </Badge>
        {transaction.origin === "refund" ? <Badge variant="secondary">Reembolso</Badge> : null}
        {transaction.anticipationId ? <Badge variant="secondary">Antecipada</Badge> : null}
        {transaction.isDivided ? <Badge variant="secondary">Dividido</Badge> : null}
      </div>
    </section>
  );
}
