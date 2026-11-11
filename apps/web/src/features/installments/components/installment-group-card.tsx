import type {
  InstallmentGroupOutput,
  InstallmentPayoffSimulationOutput,
} from "@openmonetis/validators/installments";
import { Image } from "@unpic/react";
import { AlertTriangle, ChevronRight, MessageSquareMore } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { ReportRowFact } from "@/components/report-row-fact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  formatInstallmentDate,
  installmentPaymentMethodLabels,
  installmentSeriesStatusLabels,
  payoffCheckboxClassName,
} from "../installments.presentation";
import { InstallmentDetailsDialog } from "./installment-details-dialog";
import {
  InstallmentPayoffDiscountField,
  type PayoffDiscountDraft,
} from "./installment-payoff-discount-field";

type InstallmentGroupCardProps = {
  group: InstallmentGroupOutput;
  /** Selection checkboxes appear only while a payoff is being simulated. */
  selecting: boolean;
  onToggleGroup: (installmentIds: string[]) => void;
  onToggleInstallment: (installmentId: string) => void;
  selectedIds: ReadonlySet<string>;
  /** How the simulated payoff would change this purchase, when some of it is selected. */
  payoffImpact?: InstallmentPayoffSimulationOutput["series"][number];
  payoffDiscount: PayoffDiscountDraft;
  onPayoffDiscountChange: (seriesId: string, discount: PayoffDiscountDraft) => void;
};

export function InstallmentGroupCard({
  group,
  selecting,
  onToggleGroup,
  onToggleInstallment,
  selectedIds,
  payoffImpact,
  payoffDiscount,
  onPayoffDiscountChange,
}: InstallmentGroupCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pendingInstallments = group.installments
    .filter((installment) => installment.status === "pending")
    .sort((left, right) => left.installmentNumber - right.installmentNumber);
  const pendingIds = pendingInstallments.map((installment) => installment.id);
  const nextInstallment = pendingInstallments[0];
  const selectedInGroup = pendingIds.filter((id) => selectedIds.has(id)).length;
  const allPendingSelected = pendingIds.length > 0 && selectedInGroup === pendingIds.length;
  const destinationName =
    group.cardName ?? group.accountName ?? installmentPaymentMethodLabels[group.paymentMethod];
  const completed = group.status === "completed";

  return (
    // Rows run past the content by the same inset the marked card uses, so both stay aligned and
    // the marked card keeps a gap to the dividers above and below.
    <li
      className={cn(
        "-mx-3 px-3 sm:-mx-4 sm:px-4",
        selectedInGroup > 0 ? "py-2 sm:py-2.5" : "py-4 sm:py-5",
      )}
    >
      <div
        className={cn(
          selectedInGroup > 0 && "-mx-3 rounded-xl bg-teal/5 px-3 py-3 sm:-mx-4 sm:px-4 sm:py-3.5",
        )}
      >
        <div className="grid items-center gap-x-6 gap-y-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
          <div className="flex min-w-0 items-center gap-3">
            {selecting ? (
              <Checkbox
                aria-label={`Selecionar parcelas pendentes de ${group.name}`}
                checked={allPendingSelected}
                indeterminate={selectedInGroup > 0 && !allPendingSelected}
                className={payoffCheckboxClassName}
                disabled={pendingIds.length === 0}
                onCheckedChange={() => onToggleGroup(pendingIds)}
              />
            ) : null}
            <EstablishmentLogo
              categoryIcon={group.categoryIcon}
              className="shrink-0"
              name={group.name}
              size={40}
            />
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <h3 className="min-w-0 truncate font-medium">{group.name}</h3>
                {completed ? (
                  <Badge variant="secondary">{installmentSeriesStatusLabels.completed}</Badge>
                ) : null}
                {selectedInGroup > 0 ? (
                  <Badge className="bg-teal/10 text-teal" variant="secondary">
                    {selectedInGroup} {selectedInGroup === 1 ? "marcada" : "marcadas"}
                  </Badge>
                ) : null}
                {group.note ? (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label="Ver observação"
                      render={
                        <button
                          className="relative text-muted-foreground after:absolute after:-inset-3 hover:text-foreground"
                          type="button"
                        />
                      }
                    >
                      <MessageSquareMore aria-hidden="true" className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs whitespace-pre-wrap wrap-break-word">
                      {group.note}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                {group.cardName && group.cardLogo ? (
                  <Image
                    alt=""
                    className="size-4 shrink-0 rounded-full object-contain"
                    height={16}
                    layout="fixed"
                    src={group.cardLogo}
                    width={16}
                  />
                ) : null}
                <span className="truncate">{destinationName}</span>
              </p>
              <div className="mt-2 flex max-w-64 items-center gap-2">
                <Progress
                  aria-label={`${group.paidInstallmentCount} de ${group.trackedInstallmentCount} parcelas pagas`}
                  className="h-1.5 flex-1"
                  indicatorClassName="bg-brand/70"
                  value={group.progressPercentage}
                />
                <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
                  {group.paidInstallmentCount}/{group.trackedInstallmentCount} pagas
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 md:contents">
            <ReportRowFact label="A pagar">
              {payoffImpact ? (
                <>
                  <span className="flex flex-wrap items-baseline gap-x-1.5">
                    <MoneyValue amount={payoffImpact.remainingAmount} className="font-medium" />
                    <MoneyValue
                      amount={group.pendingAmount}
                      className="text-muted-foreground text-xs line-through"
                    />
                  </span>
                  <span className="block text-muted-foreground text-xs tabular-nums">
                    {payoffImpact.remainingInstallmentCount === 0
                      ? "Quitada na simulação"
                      : `${payoffImpact.remainingInstallmentCount} ${payoffImpact.remainingInstallmentCount === 1 ? "restante" : "restantes"}`}
                  </span>
                </>
              ) : completed ? (
                <span className="text-muted-foreground">Quitada</span>
              ) : (
                <>
                  <MoneyValue amount={group.pendingAmount} className="font-medium" />
                  <span className="block text-muted-foreground text-xs tabular-nums">
                    {group.pendingInstallmentCount}{" "}
                    {group.pendingInstallmentCount === 1 ? "restante" : "restantes"}
                  </span>
                </>
              )}
            </ReportRowFact>
            <ReportRowFact
              label={group.overdueInstallmentCount > 0 ? "Em atraso desde" : "Próxima"}
            >
              {nextInstallment ? (
                <>
                  <span
                    className={cn("block", group.overdueInstallmentCount > 0 && "text-destructive")}
                  >
                    {nextInstallment.dueDate
                      ? formatInstallmentDate(nextInstallment.dueDate)
                      : formatPeriod(nextInstallment.period, true)}
                  </span>
                  <MoneyValue
                    amount={nextInstallment.amount}
                    className="text-muted-foreground text-xs"
                  />
                </>
              ) : (
                <span className="text-muted-foreground">Nenhuma</span>
              )}
            </ReportRowFact>
            <ReportRowFact label={completed ? "Terminou em" : "Termina em"}>
              {payoffImpact ? (
                <span className="flex flex-wrap items-baseline gap-x-1.5">
                  {formatPeriod(payoffImpact.endPeriod, true)}
                  {group.endPeriod && group.endPeriod !== payoffImpact.endPeriod ? (
                    <span className="text-muted-foreground text-xs line-through">
                      {formatPeriod(group.endPeriod, true)}
                    </span>
                  ) : null}
                </span>
              ) : group.endPeriod ? (
                formatPeriod(group.endPeriod, true)
              ) : (
                <span className="text-muted-foreground">Sem previsão</span>
              )}
            </ReportRowFact>
          </div>

          <Button
            aria-label={`Ver detalhes de ${group.name}`}
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
        {selecting && selectedInGroup > 0 ? (
          <InstallmentPayoffDiscountField
            discount={payoffDiscount}
            impact={payoffImpact}
            onDiscountChange={(discount) => onPayoffDiscountChange(group.seriesId, discount)}
            purchaseName={group.name}
          />
        ) : null}
        {group.missingInstallmentCount > 0 ? (
          <p className="mt-3 flex items-start gap-1.5 rounded-md bg-destructive/5 p-2 text-destructive text-xs">
            <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
            {installmentSeriesStatusLabels.incomplete}: {group.missingInstallmentCount}{" "}
            {group.missingInstallmentCount === 1 ? "parcela ausente" : "parcelas ausentes"}.
          </p>
        ) : null}
      </div>

      <InstallmentDetailsDialog
        group={group}
        onOpenChange={setDetailsOpen}
        onToggleInstallment={onToggleInstallment}
        open={detailsOpen}
        selectable={selecting}
        selectedIds={selectedIds}
      />
    </li>
  );
}
