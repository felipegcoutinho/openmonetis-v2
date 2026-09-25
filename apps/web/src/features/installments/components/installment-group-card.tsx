import type { InstallmentGroupOutput } from "@openmonetis/validators/installments";
import { Image } from "@unpic/react";
import { AlertTriangle, ChevronRight, Info } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import {
  formatInstallmentDate,
  formatInstallmentPeriod,
  installmentPaymentMethodLabels,
  installmentSeriesStatusLabels,
} from "../installments.presentation";
import { InstallmentDetailsDialog } from "./installment-details-dialog";

type InstallmentGroupCardProps = {
  group: InstallmentGroupOutput;
  onToggleGroup: (installmentIds: string[]) => void;
  onToggleInstallment: (installmentId: string) => void;
  selectedIds: ReadonlySet<string>;
};

export function InstallmentGroupCard({
  group,
  onToggleGroup,
  onToggleInstallment,
  selectedIds,
}: InstallmentGroupCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const pendingIds = group.installments
    .filter((installment) => installment.status === "pending")
    .map((installment) => installment.id);
  const selectedInGroup = pendingIds.filter((id) => selectedIds.has(id)).length;
  const allPendingSelected = pendingIds.length > 0 && selectedInGroup === pendingIds.length;
  const destinationName =
    group.cardName ?? group.accountName ?? installmentPaymentMethodLabels[group.paymentMethod];
  const statusVariant =
    group.status === "incomplete"
      ? "destructive"
      : group.status === "completed"
        ? "secondary"
        : "outline";

  return (
    <li className={cn("py-4 sm:py-5", selectedInGroup > 0 && "bg-brand/5")}>
      <div className="grid items-center gap-x-5 gap-y-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1.5fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_minmax(0,0.95fr)_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <Checkbox
            aria-label={`Selecionar parcelas pendentes de ${group.name}`}
            checked={allPendingSelected}
            disabled={pendingIds.length === 0}
            onCheckedChange={() => onToggleGroup(pendingIds)}
          />
          <EstablishmentLogo className="shrink-0" name={group.name} size={40} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate font-bold">{group.name}</h3>
              <Badge variant={statusVariant}>{installmentSeriesStatusLabels[group.status]}</Badge>
              {selectedInGroup > 0 ? (
                <Badge variant="secondary">{selectedInGroup} selecionadas</Badge>
              ) : null}
              {group.note ? (
                <Tooltip>
                  <TooltipTrigger
                    aria-label={`Anotação de ${group.name}`}
                    render={<button className="text-muted-foreground" type="button" />}
                  >
                    <Info aria-hidden="true" className="size-3.5" />
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
              <span className="truncate">
                {destinationName} · {group.paidInstallmentCount} de {group.trackedInstallmentCount}{" "}
                parcelas pagas
              </span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 md:block">
          <div>
            <p className="text-muted-foreground text-xs">Saldo pendente</p>
            <MoneyValue amount={group.pendingAmount} className="mt-1 font-medium text-base" />
          </div>
          <div className="md:hidden">
            <p className="text-muted-foreground text-xs">Progresso</p>
            <p className="mt-1 font-medium tabular-nums">{Math.round(group.progressPercentage)}%</p>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground text-xs">Próxima parcela</p>
          <p className="mt-1 font-medium text-sm">
            {group.nextDueDate
              ? formatInstallmentDate(group.nextDueDate)
              : group.nextPeriod
                ? formatInstallmentPeriod(group.nextPeriod)
                : "Sem pendências"}
          </p>
        </div>

        <div className="hidden min-w-0 items-center gap-3 xl:flex">
          <Progress
            aria-label={`Progresso das parcelas registradas: ${Math.round(group.progressPercentage)}%`}
            className="min-w-16 flex-1"
            indicatorClassName="bg-brand"
            value={group.progressPercentage}
          />
          <span className="shrink-0 text-muted-foreground text-xs tabular-nums">
            {Math.round(group.progressPercentage)}%
          </span>
        </div>

        <Button
          aria-label={`Ver detalhes de ${group.name}`}
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
      {group.missingInstallmentCount > 0 ? (
        <p className="mt-3 flex items-start gap-1.5 rounded-md bg-destructive/5 p-2 text-destructive text-xs">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          Cronograma incompleto: {group.missingInstallmentCount}{" "}
          {group.missingInstallmentCount === 1 ? "parcela ausente" : "parcelas ausentes"}.
        </p>
      ) : null}

      <InstallmentDetailsDialog
        group={group}
        onOpenChange={setDetailsOpen}
        onToggleInstallment={onToggleInstallment}
        open={detailsOpen}
        selectedIds={selectedIds}
      />
    </li>
  );
}
