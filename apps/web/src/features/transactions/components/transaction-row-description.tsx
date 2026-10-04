import { Image } from "@unpic/react";
import { MessageSquareMore, Paperclip, PartyPopper } from "lucide-react";

import { TableCell } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";

import { formatCompactDate } from "../transactions.presentation";

import { TransactionCategory } from "./transaction-category";
import { TransactionPeople } from "./transaction-people";

import type { TransactionRowProps } from "./transactions-table.types";

export function TransactionRowDescription({
  period,
  transaction,
  accountStatement,
  splitConnector,
  onView,
  isLastInstallment,
  shouldShowPersonContext,
  showPurchaseDate,
  featuredLogo,
  featuredLogoName,
  categoryLabel,
}: {
  period: TransactionRowProps["period"];
  transaction: TransactionRowProps["transaction"];
  accountStatement: TransactionRowProps["accountStatement"];
  splitConnector: TransactionRowProps["splitConnector"];
  onView: TransactionRowProps["onView"];
  isLastInstallment: boolean;
  shouldShowPersonContext: boolean;
  showPurchaseDate: boolean;
  featuredLogo: string | null;
  featuredLogoName: string;
  categoryLabel: string | null;
}) {
  return (
    <TableCell>
      <div className="relative flex min-w-64 items-center gap-2.5">
        {splitConnector && splitConnector !== "end" ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 z-10 h-11 w-px opacity-50"
            style={{ backgroundColor: "var(--muted-foreground)" }}
          />
        ) : null}
        <span className="relative z-20 inline-flex shrink-0 rounded-full bg-card">
          {featuredLogo ? (
            <Image
              alt={`Logo de ${featuredLogoName}`}
              className="size-8 shrink-0 rounded-full object-contain"
              height={32}
              layout="fixed"
              src={featuredLogo}
              width={32}
            />
          ) : (
            <EstablishmentLogo
              fallback={<CategoryIcon className="size-4" name={transaction.categoryIcon} />}
              name={transaction.name}
            />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="flex h-5 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    className="max-w-60 cursor-pointer truncate rounded-sm text-left font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => onView(transaction)}
                    type="button"
                  />
                }
              >
                {transaction.name}
              </TooltipTrigger>
              <TooltipContent>{transaction.name}</TooltipContent>
            </Tooltip>
            {transaction.condition === "installment" &&
            transaction.currentInstallment &&
            transaction.installmentCount ? (
              <span className="rounded-md border px-1.5 py-0.5 font-medium text-xs text-muted-foreground">
                {transaction.currentInstallment} de {transaction.installmentCount}
              </span>
            ) : null}
            {isLastInstallment ? (
              <Tooltip>
                <TooltipTrigger
                  aria-label="Última parcela"
                  render={<span className="inline-flex text-brand-strong" role="img" />}
                >
                  <PartyPopper aria-hidden="true" className="size-4" />
                </TooltipTrigger>
                <TooltipContent>Última parcela!</TooltipContent>
              </Tooltip>
            ) : null}
            {transaction.hasAttachments ? (
              <Paperclip className="size-3.5" aria-label="Possui anexos" />
            ) : null}
            {transaction.note ? (
              <Tooltip>
                <TooltipTrigger
                  aria-label="Ver observação"
                  render={<span className="inline-flex rounded-sm p-0.5 text-muted-foreground" />}
                >
                  <MessageSquareMore aria-hidden="true" className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs whitespace-pre-wrap">
                  {transaction.note}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {transaction.refundedAmount > 0 ? (
              <span className="rounded-md bg-success/10 px-1.5 py-0.5 font-medium text-success text-xs">
                {transaction.refundableAmount === 0 ? "Reembolsado" : "Reembolso parcial"}
              </span>
            ) : null}
            {transaction.anticipationId ? (
              <span className="rounded-md bg-brand/10 px-1.5 py-0.5 font-medium text-brand-strong text-xs">
                Antecipada
              </span>
            ) : null}
            {shouldShowPersonContext ? (
              <span className="ml-1">
                <TransactionPeople transaction={transaction} />
              </span>
            ) : null}
          </span>
          <span className="flex h-4 items-center gap-1.5 whitespace-nowrap text-muted-foreground text-xs">
            {showPurchaseDate
              ? formatCompactDate(
                  accountStatement
                    ? (transaction.postingDate ?? transaction.purchaseDate)
                    : transaction.purchaseDate,
                )
              : null}
            {transaction.categoryName ? (
              <>
                {showPurchaseDate ? <span aria-hidden="true">·</span> : null}
                <TransactionCategory
                  categoryLabel={categoryLabel}
                  period={period}
                  transaction={transaction}
                />
              </>
            ) : null}
            {transaction.dueDate ? (
              <span className="text-brand-strong">
                {showPurchaseDate || transaction.categoryName ? "· " : null}
                Venc. {formatCompactDate(transaction.dueDate)}
              </span>
            ) : null}
            {!accountStatement &&
            transaction.paymentMethod === "boleto" &&
            transaction.boletoPaymentDate ? (
              <span className="text-success">
                {showPurchaseDate || transaction.categoryName || transaction.dueDate ? "· " : null}
                Pago {formatCompactDate(transaction.boletoPaymentDate)}
              </span>
            ) : null}
          </span>
        </span>
      </div>
    </TableCell>
  );
}
