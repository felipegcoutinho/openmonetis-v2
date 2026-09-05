import type { InstallmentGroupOutput } from "@openmonetis/validators/installments";
import { Image } from "@unpic/react";
import { AlertTriangle, CalendarClock, ChevronRight, CircleCheckBig, Landmark } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
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
  const statusVariant = group.status === "incomplete" ? "destructive" : "outline";

  return (
    <>
      <Card
        className={cn(
          "overflow-hidden transition-colors",
          selectedInGroup > 0 && "border-brand-strong/40 bg-brand/[0.02]",
        )}
      >
        <CardHeader className="gap-4">
          <div className="flex items-start gap-3">
            <Checkbox
              aria-label={["Selecionar parcelas pendentes de", group.name].join(" ")}
              checked={allPendingSelected}
              disabled={pendingIds.length === 0}
              onCheckedChange={() => onToggleGroup(pendingIds)}
            />
            <EstablishmentLogo name={group.name} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="truncate">{group.name}</CardTitle>
                <Badge variant={statusVariant}>{installmentSeriesStatusLabels[group.status]}</Badge>
              </div>
              <p className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                {group.cardId ? (
                  group.cardLogo ? (
                    <Image
                      alt=""
                      className="size-5 shrink-0 rounded object-contain"
                      height={20}
                      layout="fixed"
                      src={group.cardLogo}
                      width={20}
                    />
                  ) : null
                ) : (
                  <Landmark aria-hidden="true" className="size-3.5 shrink-0" />
                )}
                <span className="truncate">{destinationName}</span>
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/40 p-3">
            <div>
              <p className="text-muted-foreground text-xs">Saldo pendente</p>
              <MoneyValue amount={group.pendingAmount} className="mt-1 font-semibold text-lg" />
            </div>
            <div className="text-right">
              <p className="text-muted-foreground text-xs">Valor acompanhado</p>
              <MoneyValue amount={group.trackedAmount} className="mt-1 font-semibold text-lg" />
            </div>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <CircleCheckBig aria-hidden="true" className="size-3.5 text-success" />
                {group.paidInstallmentCount} de {group.trackedInstallmentCount} acompanhadas pagas
              </span>
              <span className="font-mono tabular-nums">
                {Math.round(group.progressPercentage)}%
              </span>
            </div>
            <Progress
              aria-label="Progresso das parcelas acompanhadas"
              indicatorClassName="bg-success"
              value={group.progressPercentage}
            />
            <p className="text-muted-foreground text-xs">
              Acompanhando desde {group.trackedFromInstallment}/{group.totalInstallments}
              {group.untrackedInstallmentCount > 0
                ? ` · ${group.untrackedInstallmentCount} anteriores fora do acompanhamento`
                : " · série completa"}
            </p>
          </div>

          {group.missingInstallmentCount > 0 ? (
            <p className="flex items-start gap-1.5 rounded-md bg-destructive/5 p-2 text-destructive text-xs">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              Cronograma incompleto: {group.missingInstallmentCount}{" "}
              {group.missingInstallmentCount === 1 ? "parcela ausente" : "parcelas ausentes"}.
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar size="sm">
                <AvatarImage alt={group.personName} src={group.personAvatarUrl ?? undefined} />
                <AvatarFallback>{initials(group.personName)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-xs">{group.personName}</p>
                <p className="flex items-center gap-1 text-muted-foreground text-xs">
                  <CalendarClock aria-hidden="true" className="size-3" />
                  {group.nextDueDate
                    ? `Próxima em ${formatInstallmentDate(group.nextDueDate)}`
                    : group.nextPeriod
                      ? `Próxima em ${formatInstallmentPeriod(group.nextPeriod)}`
                      : "Sem parcela pendente"}
                </p>
              </div>
            </div>
            <Button onClick={() => setDetailsOpen(true)} size="sm" type="button" variant="outline">
              Detalhes
              {selectedInGroup > 0 ? (
                <Badge className="ml-1" variant="secondary">
                  {selectedInGroup}
                </Badge>
              ) : null}
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <InstallmentDetailsDialog
        group={group}
        onOpenChange={setDetailsOpen}
        onToggleInstallment={onToggleInstallment}
        open={detailsOpen}
        selectedIds={selectedIds}
      />
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toLocaleUpperCase("pt-BR");
}
