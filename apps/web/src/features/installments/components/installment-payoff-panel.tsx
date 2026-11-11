import type { InstallmentPayoffSimulationOutput } from "@openmonetis/validators/installments";
import { ArrowRight, CheckCheck, HandCoins, MousePointerClick, X } from "lucide-react";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriod } from "@/lib/period-presentation";

type InstallmentPayoffPanelProps = {
  selectedCount: number;
  allPendingSelected: boolean;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onClose: () => void;
  simulation: InstallmentPayoffSimulationOutput | null;
  isLoading: boolean;
  errorMessage: string | null;
};

/**
 * Summary of the payoff being simulated. Teal marks everything that belongs to it (this panel,
 * the marked purchases and the chart series), the way blue marks a simulated purchase.
 */
export function InstallmentPayoffPanel({
  selectedCount,
  allPendingSelected,
  onSelectAll,
  onClearSelection,
  onClose,
  simulation,
  isLoading,
  errorMessage,
}: InstallmentPayoffPanelProps) {
  const invalidDiscountCount =
    simulation?.series.filter((item) => item.discountOutOfRange).length ?? 0;

  return (
    <section
      aria-label="Simulação de quitação"
      className="overflow-hidden rounded-xl border border-teal/25 bg-teal/5"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-teal/15 text-teal">
            <HandCoins aria-hidden="true" className="size-4.5" />
          </span>
          <div className="min-w-0">
            <p className="font-medium">Simulando quitação</p>
            <p className="text-pretty text-muted-foreground text-sm">
              Nada é alterado: é só uma conta para comparar com a oferta do banco.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:shrink-0">
          <Button
            onClick={allPendingSelected ? onClearSelection : onSelectAll}
            size="sm"
            type="button"
            variant="outline"
          >
            <CheckCheck aria-hidden="true" />
            {allPendingSelected ? "Desmarcar todas" : "Marcar todas"}
          </Button>
          <Button onClick={onClose} size="sm" type="button" variant="ghost">
            <X aria-hidden="true" />
            Encerrar
          </Button>
        </div>
      </div>

      {selectedCount === 0 ? (
        <p className="flex items-start gap-2 border-teal/20 border-t bg-background/60 px-4 py-3 text-muted-foreground text-sm">
          <MousePointerClick aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-teal" />
          <span className="text-pretty">
            Marque a caixa ao lado de uma compra para quitar todas as parcelas restantes, ou escolha
            parcelas avulsas em <span className="font-medium text-foreground">Detalhes</span>.
            Depois informe a oferta do banco na própria compra.
          </span>
        </p>
      ) : (
        <div
          aria-live="polite"
          className="grid gap-4 border-teal/20 border-t bg-background/60 p-4 sm:grid-cols-3 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] lg:items-center"
        >
          <div className="min-w-0 sm:col-span-3 lg:col-span-1">
            <p className="text-muted-foreground text-xs">
              {simulation
                ? `Total para quitar em ${formatPeriod(simulation.payoffPeriod, true)}`
                : "Total para quitar"}
            </p>
            {simulation && !isLoading ? (
              <p className="mt-0.5 flex flex-wrap items-baseline gap-x-2 tabular-nums">
                <MoneyValue
                  amount={simulation.payoffAmount}
                  className="kpi-value text-2xl text-teal"
                />
                {simulation.discountAmount > 0 ? (
                  <span className="text-sm text-success">
                    economia de <MoneyValue amount={simulation.discountAmount} /> (
                    {simulation.discountPercentage.toLocaleString("pt-BR")}%)
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm">sem desconto</span>
                )}
              </p>
            ) : (
              <Skeleton className="mt-1 h-8 w-40" />
            )}
          </div>
          <Fact label="Parcelas marcadas">
            {simulation ? (
              <>
                {selectedCount}
                <span className="font-normal text-muted-foreground">
                  {" · "}
                  <MoneyValue amount={simulation.totalAmount} />
                </span>
              </>
            ) : (
              <Placeholder />
            )}
          </Fact>
          <Fact label="Alívio no próximo mês">
            {simulation ? (
              <MoneyValue amount={simulation.nextMonthReliefAmount} />
            ) : (
              <Placeholder />
            )}
          </Fact>
          <Fact label="Última parcela">
            {simulation ? (
              <LastInstallmentChange
                current={simulation.lastInstallmentPeriod.current}
                simulated={simulation.lastInstallmentPeriod.simulated}
              />
            ) : (
              <Placeholder />
            )}
          </Fact>
        </div>
      )}

      {errorMessage || invalidDiscountCount > 0 ? (
        <p
          className="border-destructive/20 border-t bg-destructive/5 px-4 py-2 text-destructive text-sm"
          role="alert"
        >
          {errorMessage ??
            (invalidDiscountCount === 1
              ? "Uma compra tem oferta inválida e foi calculada sem desconto."
              : `${invalidDiscountCount} compras têm oferta inválida e foram calculadas sem desconto.`)}
        </p>
      ) : null}
    </section>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <dl className="min-w-0 lg:border-teal/15 lg:border-l lg:pl-4">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium text-sm tabular-nums">{children}</dd>
    </dl>
  );
}

function Placeholder() {
  return <Skeleton className="h-5 w-20" />;
}

function LastInstallmentChange({
  current,
  simulated,
}: {
  current: string | null;
  simulated: string | null;
}) {
  if (current === simulated) {
    return (
      <>
        {simulated ? formatPeriod(simulated, true) : "Nenhuma"}
        <span className="font-normal text-muted-foreground"> · sem mudança</span>
      </>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <span className="font-normal text-muted-foreground line-through">
        {current ? formatPeriod(current, true) : "—"}
      </span>
      <ArrowRight aria-label="passa para" className="size-3.5 text-muted-foreground" />
      {simulated ? formatPeriod(simulated, true) : "Nenhuma"}
    </span>
  );
}
