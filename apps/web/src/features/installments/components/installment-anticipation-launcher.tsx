import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { CalendarArrowDown, CircleAlert } from "lucide-react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { installmentsQueryOptions } from "../installments.queries";
import { InstallmentAnticipationDialog } from "./installment-anticipation-dialog";

export function InstallmentAnticipationLauncher({
  onOpenChange,
  open,
  targetPeriod,
  transaction,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  targetPeriod: string;
  transaction: TransactionOutput | null;
}) {
  const seriesId = transaction?.seriesId ?? "";
  const reportQuery = useQuery({
    ...installmentsQueryOptions({ period: targetPeriod, status: "all" }),
    enabled: open && Boolean(seriesId),
  });
  const group = reportQuery.data?.groups.find((item) => item.seriesId === seriesId) ?? null;
  const eligibleInstallments =
    group?.installments
      .filter(
        (installment) => installment.status === "pending" && installment.period > targetPeriod,
      )
      .sort((left, right) => left.installmentNumber - right.installmentNumber) ?? [];

  if (reportQuery.isLoading) {
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent mobileLayout="sheet">
          <DialogHeader>
            <DialogTitle>Preparando antecipação</DialogTitle>
            <DialogDescription>Buscando as parcelas futuras desta compra.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2" role="status">
            <Skeleton className="h-20" />
            <Skeleton className="h-10" />
            <span className="sr-only">Carregando parcelas…</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (reportQuery.isError || !group || eligibleInstallments.length === 0) {
    const unavailable = Boolean(reportQuery.data && group && eligibleInstallments.length === 0);
    return (
      <Dialog onOpenChange={onOpenChange} open={open}>
        <DialogContent mobileLayout="sheet">
          <DialogHeader>
            <span className="mb-1 grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
              {unavailable ? (
                <CalendarArrowDown aria-hidden="true" className="size-5" />
              ) : (
                <CircleAlert aria-hidden="true" className="size-5" />
              )}
            </span>
            <DialogTitle>
              {unavailable ? "Nenhuma parcela para antecipar" : "Não foi possível carregar"}
            </DialogTitle>
            <DialogDescription>
              {unavailable
                ? "Esta compra não possui parcelas futuras pendentes em relação ao mês selecionado."
                : "Atualize os lançamentos e tente novamente."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} type="button">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <InstallmentAnticipationDialog
      eligibleInstallments={eligibleInstallments}
      group={group}
      onOpenChange={onOpenChange}
      open={open}
      targetPeriod={targetPeriod}
    />
  );
}
