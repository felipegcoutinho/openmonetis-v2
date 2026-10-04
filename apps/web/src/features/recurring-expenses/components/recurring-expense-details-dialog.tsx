import { CalendarDays, CalendarX2, Pause, Pencil, Play, Square } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";

import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MoneyValue } from "@/components/money-value";

import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import {
  formatRecurringExpenseDate,
  recurringFrequencyLabels,
} from "../recurring-expenses.presentation";
import { RecurringDestination } from "./recurring-destination";
import type { ReportItem } from "./recurring-expenses-report-page.types";
import { recurringPaymentMethodIcons } from "./recurring-expenses-report-page-options";
import { RecurringPeople } from "./recurring-people";
export function RecurringExpenseDetailsDialog({
  item,
  detailsOpen,
  setDetailsOpen,
  onEdit,
  canManage,
  chooseRowAction,
}: {
  item: ReportItem;
  detailsOpen: boolean;
  setDetailsOpen: Dispatch<SetStateAction<boolean>>;
  onEdit: (expense: ReportItem) => void;
  canManage: boolean;
  chooseRowAction: (action: "pause" | "resume" | "skip" | "stop") => void;
}) {
  const PaymentIcon = recurringPaymentMethodIcons[item.paymentMethod];
  return (
    <Dialog onOpenChange={setDetailsOpen} open={detailsOpen}>
      <DialogContent data-mobile-details className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <div className="flex min-w-0 items-center gap-3 pr-8">
            <EstablishmentLogo className="shrink-0" name={item.name} size={40} />
            <div className="min-w-0">
              <DialogTitle className="truncate">{item.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {recurringFrequencyLabels[item.frequency]} ·{" "}
                {item.status === "active" ? "Ativa" : "Pausada"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="contents" data-mobile-detail-body>
          <div className="grid gap-3 rounded-lg bg-muted/40 p-4 sm:grid-cols-2">
            <div>
              <p className="text-muted-foreground text-xs">Sua parte por ocorrência</p>
              <MoneyValue amount={item.amount} className="mt-1 font-semibold" />
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Valor total por ocorrência</p>
              <MoneyValue amount={item.totalAmount} className="mt-1 font-semibold" />
            </div>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs">Próxima ocorrência</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                <CalendarDays
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground"
                />
                {item.status === "paused"
                  ? "Sem lançamentos durante a pausa"
                  : item.nextOccurrenceDate
                    ? formatRecurringExpenseDate(item.nextOccurrenceDate)
                    : "Sem previsão"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Forma de pagamento</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                <PaymentIcon aria-hidden="true" className="size-4 text-muted-foreground" />
                {paymentMethodLabels[item.paymentMethod]}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Conta ou cartão</dt>
              <dd className="mt-1 font-medium">
                <RecurringDestination item={item} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs">Categoria</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-medium">
                <CategoryIcon className="size-4 text-muted-foreground" name={item.categoryIcon} />
                {item.categoryName ?? "Sem categoria"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground text-xs">Pessoas</dt>
              <dd className="mt-1 font-medium">
                <RecurringPeople item={item} />
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
            {item.status === "active" ? (
              <>
                <Button
                  disabled={!canManage}
                  onClick={() => {
                    setDetailsOpen(false);
                    onEdit(item);
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Pencil aria-hidden="true" /> Alterar
                </Button>
                <Button
                  disabled={!canManage}
                  onClick={() => chooseRowAction("skip")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <CalendarX2 aria-hidden="true" /> Pular próximo
                </Button>
                <Button
                  disabled={!canManage}
                  onClick={() => chooseRowAction("pause")}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Pause aria-hidden="true" /> Pausar
                </Button>
              </>
            ) : (
              <Button
                disabled={!canManage}
                onClick={() => chooseRowAction("resume")}
                size="sm"
                type="button"
                variant="outline"
              >
                <Play aria-hidden="true" /> Retomar
              </Button>
            )}
            <Button
              disabled={!canManage}
              onClick={() => chooseRowAction("stop")}
              size="sm"
              type="button"
              variant="destructive"
            >
              <Square aria-hidden="true" /> Parar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
