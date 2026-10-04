import type { TransactionOutput } from "@openmonetis/validators/transactions";

import { Circle, CircleCheck, CreditCard } from "lucide-react";

import { MoneyValue } from "@/components/money-value";

import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import { transactionConditionLabels } from "../transactions.presentation";

import { TransactionTypeBadge } from "./transaction-type-badge";

export function TransactionSummary({ transaction }: { transaction: TransactionOutput }) {
  const status =
    transaction.isSettled === null
      ? { label: "Pagamento pela fatura", className: "bg-secondary text-secondary-foreground" }
      : transaction.isSettled
        ? {
            label:
              transaction.type === "income"
                ? "Recebido"
                : transaction.type === "transfer"
                  ? "Realizada"
                  : "Pago",
            className: "bg-success/10 text-success",
          }
        : { label: "Em aberto", className: "bg-warning/10 text-foreground" };
  const amountClassName =
    transaction.type === "income"
      ? "text-success"
      : transaction.type === "transfer"
        ? "text-info"
        : "text-foreground";

  return (
    <section className="min-w-0 pb-3 sm:rounded-xl sm:border sm:bg-muted/30 sm:p-4">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
        <div className="min-w-0">
          <p className="sr-only sm:not-sr-only sm:text-muted-foreground sm:text-xs">
            Total do lançamento
          </p>
          <MoneyValue
            amount={transaction.amount}
            className={cn(
              "block max-w-full break-all text-3xl font-semibold tracking-tight sm:mt-1 sm:text-2xl",
              amountClassName,
            )}
            showPositiveSign={transaction.type === "income"}
          />
        </div>
        <Badge className={status.className} variant="secondary">
          {transaction.isSettled === null ? (
            <CreditCard aria-hidden="true" />
          ) : transaction.isSettled ? (
            <CircleCheck aria-hidden="true" />
          ) : (
            <Circle aria-hidden="true" />
          )}
          {status.label}
        </Badge>
      </div>
      <div className="mt-3 flex flex-wrap justify-center gap-2 sm:mt-4 sm:justify-start">
        <span className="hidden sm:contents">
          <TransactionTypeBadge type={transaction.type} />
          <Badge variant="outline">{transactionConditionLabels[transaction.condition]}</Badge>
        </span>
        {transaction.origin === "refund" ? <Badge variant="secondary">Reembolso</Badge> : null}
        {transaction.anticipationId ? <Badge variant="secondary">Antecipada</Badge> : null}
        {transaction.isDivided ? <Badge variant="secondary">Dividido</Badge> : null}
      </div>
    </section>
  );
}
