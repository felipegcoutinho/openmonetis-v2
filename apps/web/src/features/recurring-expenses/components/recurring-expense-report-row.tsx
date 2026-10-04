import { ChevronRight } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import {
  formatRecurringExpenseCompactDate,
  recurringFrequencyLabels,
} from "../recurring-expenses.presentation";
import { RecurringExpenseDetailsDialog } from "./recurring-expense-details-dialog";

import type { ReportItem } from "./recurring-expenses-report-page.types";
import { recurringPaymentMethodIcons } from "./recurring-expenses-report-page-options";

export function RecurringExpenseReportRow({
  item,
  onAction,
  onEdit,
}: {
  item: ReportItem;
  onAction: (expense: ReportItem, action: "pause" | "resume" | "skip" | "stop") => void;
  onEdit: (expense: ReportItem) => void;
}) {
  const PaymentIcon = recurringPaymentMethodIcons[item.paymentMethod];
  const canManage = Boolean(item.actionDate);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const destinationName = item.cardName ?? item.accountName;
  const destinationLogo = item.cardLogo ?? item.accountLogo;

  function chooseRowAction(nextAction: "pause" | "resume" | "skip" | "stop") {
    setDetailsOpen(false);
    onAction(item, nextAction);
  }

  return (
    <li className="py-4 sm:py-5">
      <div className="grid items-center gap-x-5 gap-y-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <EstablishmentLogo className="shrink-0" name={item.name} size={40} />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate font-bold">{item.name}</h3>
              <Badge variant={item.status === "active" ? "outline" : "secondary"}>
                {item.status === "active" ? "Ativa" : "Pausada"}
              </Badge>
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              {destinationLogo ? (
                <Avatar className="size-4 shrink-0">
                  <AvatarImage alt="" src={destinationLogo} />
                  <AvatarFallback>
                    <PaymentIcon aria-hidden="true" className="size-3" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <PaymentIcon aria-hidden="true" className="size-4 shrink-0" />
              )}
              <span className="truncate">
                {destinationName ?? paymentMethodLabels[item.paymentMethod]} ·{" "}
                {recurringFrequencyLabels[item.frequency]}
              </span>
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:col-span-2 md:gap-5 xl:col-span-2">
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Sua parte</p>
            <MoneyValue amount={item.amount} className="mt-1 font-medium text-base" />
          </div>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs">Próxima ocorrência</p>
            <p className="mt-1 font-medium text-sm">
              {item.status === "paused"
                ? "Pausada"
                : item.nextOccurrenceDate
                  ? formatRecurringExpenseCompactDate(item.nextOccurrenceDate)
                  : "Sem previsão"}
            </p>
          </div>
        </div>
        <Button
          aria-label={`Ver detalhes de ${item.name}`}
          className="w-full justify-between md:col-span-3 xl:col-span-1 xl:w-auto"
          onClick={() => setDetailsOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          Detalhes
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <RecurringExpenseDetailsDialog
        item={item}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onEdit={onEdit}
        canManage={canManage}
        chooseRowAction={chooseRowAction}
      />
    </li>
  );
}
