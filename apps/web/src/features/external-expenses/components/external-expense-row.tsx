import type { ExternalExpenseOutput } from "@openmonetis/validators/external-expenses";

import {
  Banknote,
  Barcode,
  CalendarClock,
  Check,
  CreditCard,
  Landmark,
  RefreshCw,
  Split,
} from "lucide-react";

import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";

import { TableCell, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";

import {
  formatCompactDate,
  formatPaymentMethodTable,
  transactionConditionLabels,
} from "@/features/transactions/transactions.presentation";

import { ExternalCounterpartAvatar } from "./external-counterpart-avatar";
import { ExternalExpenseSource } from "./external-expense-source";

export function ExternalExpenseRow({
  importPending,
  item,
  onImport,
  onReview,
}: {
  importPending: boolean;
  item: ExternalExpenseOutput;
  onImport: () => void;
  onReview: () => void;
}) {
  const PaymentIcon =
    item.snapshot.paymentMethod === "credit_card" || item.snapshot.paymentMethod === "debit_card"
      ? CreditCard
      : item.snapshot.paymentMethod === "boleto"
        ? Barcode
        : item.snapshot.paymentMethod === "cash"
          ? Banknote
          : Landmark;
  const recurringDateLabel =
    item.sourceKind !== "recurringOccurrence"
      ? null
      : item.snapshot.paymentMethod === "boleto"
        ? "Vence em "
        : "Ocorrência em ";
  const displayedDate =
    item.sourceKind === "recurringOccurrence" && item.snapshot.paymentMethod === "boleto"
      ? (item.snapshot.dueDate ?? item.snapshot.purchaseDate)
      : item.snapshot.purchaseDate;

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-56 items-center gap-2.5">
          <EstablishmentLogo
            fallbackLogoUrl={item.establishmentLogoUrl}
            name={item.snapshot.name}
            size={36}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="max-w-56 truncate font-medium">{item.snapshot.name}</span>
              {item.isDivided ? (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Lançamento dividido"
                    className="inline-flex shrink-0 rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Split aria-hidden="true" className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>Lançamento dividido</TooltipContent>
                </Tooltip>
              ) : null}
            </span>
            <span className="whitespace-nowrap text-muted-foreground text-xs">
              {recurringDateLabel}
              {formatCompactDate(displayedDate)}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <MoneyValue amount={-item.snapshot.amount} className="font-medium" />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
          {item.snapshot.condition === "installment" ? (
            <CalendarClock aria-hidden="true" size={14} />
          ) : item.snapshot.condition === "recurring" ? (
            <RefreshCw aria-hidden="true" size={14} />
          ) : (
            <Check aria-hidden="true" size={14} />
          )}
          {transactionConditionLabels[item.snapshot.condition]}
          {item.snapshot.installmentCount ? ` · ${item.snapshot.installmentCount}x` : ""}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        <PaymentIcon className="mr-2 inline size-4" />
        {formatPaymentMethodTable(item.snapshot.paymentMethod)}
      </TableCell>
      <TableCell>
        <span className="inline-flex min-w-40 items-center gap-2">
          <ExternalCounterpartAvatar
            avatarUrl={item.counterpartAvatarUrl}
            className="size-7"
            name={item.counterpartName}
          />
          <span className="grid">
            <span className="text-muted-foreground text-xs">Compartilhado por</span>
            <span className="font-medium text-sm">{item.counterpartName}</span>
          </span>
        </span>
      </TableCell>
      <TableCell>
        <span className="whitespace-nowrap text-muted-foreground">
          <ExternalExpenseSource
            sourceCardBrand={item.sourceCardBrand}
            sourceLabel={item.snapshot.sourceLabel}
            sourceLogoUrl={item.sourceLogoUrl}
          />
          {!item.snapshot.sourceLabel ? "—" : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-2">
          <Button disabled={importPending} onClick={onReview} size="sm" variant="ghost">
            {item.status === "ignored" ? "Restaurar" : "Ignorar"}
          </Button>
          {item.status === "pending" ? (
            <Button disabled={importPending} onClick={onImport} size="sm">
              Importar para minha conta
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}
