import type { PersonOutput } from "@openmonetis/validators/people";
import type { PersonSettlementOutput } from "@openmonetis/validators/person-settlements";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownToLine, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/features/accounts/accounts.presentation";
import {
  useCreatePersonSettlementMutation,
  useDeletePersonSettlementMutation,
} from "../person-settlements.mutations";
import { formatPersonBalance, personBalanceLabel } from "../person-settlements.presentation";
import { personSettlementQueryOptions } from "../person-settlements.queries";
import { PersonSettlementDialog } from "./person-settlement-dialog";

export function PersonSettlementsCard({
  person,
  period,
}: {
  person: PersonOutput;
  period: string;
}) {
  const [open, setOpen] = useState(false);
  const [removingSettlement, setRemovingSettlement] = useState<PersonSettlementOutput | null>(null);
  const snapshotQuery = useQuery(personSettlementQueryOptions(person.id, period));
  const createSettlement = useCreatePersonSettlementMutation();
  const deleteSettlement = useDeletePersonSettlementMutation();

  if (person.role !== "external") return null;

  async function submit(input: Parameters<typeof createSettlement.mutateAsync>[0]) {
    await createSettlement.mutateAsync(input);
    setOpen(false);
    toast.success("Repasse registrado");
  }

  async function remove() {
    if (!removingSettlement) return;

    try {
      await deleteSettlement.mutateAsync(removingSettlement.id);
      setRemovingSettlement(null);
      toast.success("Repasse excluído");
    } catch {
      toast.error("Não foi possível excluir o repasse");
    }
  }

  const snapshot = snapshotQuery.data;
  const balance = snapshot?.balance;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownToLine aria-hidden="true" className="size-4 text-muted-foreground" />
            Acertos
          </CardTitle>
          <CardDescription className="text-xs">
            Histórico de pagamentos da pessoa, sem movimentar suas contas.
          </CardDescription>
          <CardAction>
            <Button disabled={person.status === "inactive"} onClick={() => setOpen(true)} size="sm">
              Registrar repasse
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4">
          {snapshotQuery.isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando acertos…</p>
          ) : null}
          {snapshotQuery.isError ? (
            <p className="text-destructive text-sm" role="alert">
              Não foi possível carregar os acertos.
            </p>
          ) : null}
          {balance ? (
            <div className="grid gap-2 sm:grid-cols-3">
              <BalanceMetric label="Atribuído" value={formatCurrency(balance.assignedAmount)} />
              <BalanceMetric label="Recebido" value={formatCurrency(balance.settledAmount)} />
              <BalanceMetric
                label={personBalanceLabel(balance.status)}
                value={formatPersonBalance(balance)}
                emphasized
              />
            </div>
          ) : null}
          {snapshot?.settlements.length ? (
            <div className="grid gap-2">
              <p className="font-medium text-sm">Repasses no período</p>
              <div className="divide-y rounded-md border">
                {snapshot.settlements.map((settlement) => (
                  <div
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                    key={settlement.id}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{formatCurrency(settlement.amount)}</p>
                      <div className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
                        <span className="shrink-0">
                          {formatSettlementDate(settlement.receivedAt)}
                        </span>
                        <span className="truncate">
                          {settlement.source === "invoicePayment" ? " · Fatura" : " · Manual"}
                          {settlement.note ? ` · ${settlement.note}` : ""}
                        </span>
                      </div>
                    </div>
                    {settlement.source === "manual" ? (
                      <Button
                        aria-label="Excluir repasse"
                        disabled={deleteSettlement.isPending}
                        onClick={() => setRemovingSettlement(settlement)}
                        size="icon-xs"
                        variant="ghost"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </CardContent>
        <PersonSettlementDialog
          onOpenChange={setOpen}
          onSubmit={submit}
          open={open}
          personId={person.id}
          personName={person.name}
        />
      </Card>

      <AlertDialog
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !deleteSettlement.isPending) setRemovingSettlement(null);
        }}
        open={Boolean(removingSettlement)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Excluir este repasse?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mb-2 block font-medium text-foreground">
                {removingSettlement ? formatCurrency(removingSettlement.amount) : null}
              </span>
              <span>
                O registro será removido e o saldo com {person.name} será recalculado. Esta ação não
                pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSettlement.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteSettlement.isPending}
              onClick={(event) => {
                event.preventDefault();
                void remove();
              }}
              variant="destructive"
            >
              {deleteSettlement.isPending ? "Excluindo…" : "Excluir repasse"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function BalanceMetric({
  emphasized = false,
  label,
  value,
}: {
  emphasized?: boolean;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className={emphasized ? "mt-1 font-semibold text-lg" : "mt-1 font-medium text-sm"}>
        {value}
      </p>
    </div>
  );
}

function formatSettlementDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}
