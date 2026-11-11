import type { InstallmentPurchaseSimulationOutput } from "@openmonetis/validators/installments";
import { Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { ReportRowFact } from "@/components/report-row-fact";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPeriod } from "@/lib/period-presentation";
import { CardOptionAvatar } from "./card-option-avatar";

type SimulatedPurchaseRowProps = {
  simulation: InstallmentPurchaseSimulationOutput;
  onEdit: () => void;
  onRemove: () => void;
};

/** Hypothetical purchase shown above the real ones, styled apart so it is never mistaken. */
export function SimulatedPurchaseRow({ simulation, onEdit, onRemove }: SimulatedPurchaseRowProps) {
  return (
    <section
      aria-label="Compra simulada"
      className="rounded-lg border border-info/40 border-dashed bg-info/5 p-4"
    >
      <div className="grid items-center gap-x-6 gap-y-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-info/10 text-info">
            <ShoppingBag aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="min-w-0 truncate font-medium">
                {simulation.name ?? "Compra simulada"}
              </h3>
              <Badge className="border-info/40 text-info" variant="outline">
                Simulação
              </Badge>
            </div>
            <p className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              <CardOptionAvatar logo={simulation.cardLogo} />
              <span className="truncate">{simulation.cardName}</span>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 md:contents">
          <ReportRowFact label="Valor">
            <MoneyValue amount={simulation.amount} />
            <span className="block font-normal text-muted-foreground text-xs">
              {simulation.installmentCount}x de <MoneyValue amount={simulation.installmentAmount} />
            </span>
          </ReportRowFact>
          <ReportRowFact label="Começa em">
            {formatPeriod(simulation.firstPeriod, true)}
            <span className="block font-normal text-muted-foreground text-xs">
              {simulation.invoicePeriodChosen ? "Fatura escolhida" : "Pelo fechamento"}
            </span>
          </ReportRowFact>
          <ReportRowFact label="Termina em">
            {formatPeriod(simulation.endPeriod, true)}
          </ReportRowFact>
        </div>

        <div className="flex gap-2">
          <Button
            aria-label="Editar simulação"
            className="flex-1 md:flex-none"
            onClick={onEdit}
            size="sm"
            type="button"
            variant="outline"
          >
            <Pencil aria-hidden="true" />
            <span className="md:sr-only">Editar</span>
          </Button>
          <Button
            aria-label="Remover simulação"
            className="flex-1 md:flex-none"
            onClick={onRemove}
            size="sm"
            type="button"
            variant="outline"
          >
            <Trash2 aria-hidden="true" />
            <span className="md:sr-only">Remover</span>
          </Button>
        </div>
      </div>
    </section>
  );
}
