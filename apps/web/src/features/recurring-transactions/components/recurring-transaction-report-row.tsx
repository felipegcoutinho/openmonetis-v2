import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { ReportRowFact } from "@/components/report-row-fact";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import {
  formatRecurringExpenseCompactDate,
  recurringFrequencyLabels,
} from "@/features/recurring-expenses/recurring-expenses.presentation";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import {
  recurringAmountSuffixLabels,
  recurringStatusLabels,
} from "../recurring-transactions.presentation";
import { RecurringTransactionDetailsDialog } from "./recurring-transaction-details-dialog";
import type { ReportItem } from "./recurring-transactions-report-page.types";
import { recurringPaymentMethodIcons } from "./recurring-transactions-report-page-options";

export function RecurringTransactionReportRow({
  item,
  onAction,
  onEdit,
  canEdit,
}: {
  item: ReportItem;
  canEdit: boolean;
  onAction: (expense: ReportItem, action: "pause" | "resume" | "skip" | "stop") => void;
  onEdit: (expense: ReportItem) => void;
}) {
  const PaymentIcon = recurringPaymentMethodIcons[item.paymentMethod];
  const canManage = Boolean(item.actionDate);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const destinationName = item.cardName ?? item.accountName;
  const destinationLogo = item.cardLogo ?? item.accountLogo;
  const active = item.status === "active";
  const shared = item.splitPeople.length > 0;

  function chooseRowAction(nextAction: "pause" | "resume" | "skip" | "stop") {
    setDetailsOpen(false);
    onAction(item, nextAction);
  }

  return (
    <li className="py-4 sm:py-5">
      <div className="grid items-center gap-x-6 gap-y-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <EstablishmentLogo
            categoryIcon={item.categoryIcon}
            className={active ? "shrink-0" : "shrink-0 opacity-70"}
            name={item.name}
            size={40}
          />
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate font-medium">{item.name}</h3>
              {active ? null : (
                <Badge variant="secondary">{recurringStatusLabels[item.status]}</Badge>
              )}
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
                {destinationName ?? paymentMethodLabels[item.paymentMethod]}
                {item.categoryName ? ` · ${item.categoryName}` : ""}
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 md:contents">
          <ReportRowFact label={shared ? "Sua parte" : "Valor"}>
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-1">
              <MoneyValue amount={item.amount} />
              <span
                className="font-normal text-muted-foreground text-xs"
                title={recurringFrequencyLabels[item.frequency]}
              >
                {recurringAmountSuffixLabels[item.frequency]}
              </span>
            </span>
          </ReportRowFact>
          <ReportRowFact label="Próxima">
            {active && item.nextOccurrenceDate ? (
              formatRecurringExpenseCompactDate(item.nextOccurrenceDate)
            ) : (
              <Muted>{active ? "Sem previsão" : "Nenhuma"}</Muted>
            )}
          </ReportRowFact>
          <ReportRowFact label="Termina em">
            {item.recurrenceEndDate ? (
              formatRecurringExpenseCompactDate(item.recurrenceEndDate)
            ) : (
              <Muted>{item.status === "ended" ? "Encerrada" : "Sem prazo"}</Muted>
            )}
          </ReportRowFact>
        </div>

        <Button
          aria-label={`Ver detalhes de ${item.name}`}
          className="w-full justify-between md:w-auto"
          onClick={() => setDetailsOpen(true)}
          size="sm"
          type="button"
          variant="outline"
        >
          Detalhes
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </div>

      <RecurringTransactionDetailsDialog
        item={item}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        onEdit={onEdit}
        canManage={canManage}
        canEdit={canEdit}
        chooseRowAction={chooseRowAction}
      />
    </li>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>;
}
