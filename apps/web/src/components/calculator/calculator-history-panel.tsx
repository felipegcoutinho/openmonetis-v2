import { usePrivacyMode } from "@/components/privacy-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { CalculatorHistoryEntry } from "./calculator-history";
import { formatCalculatorValue } from "./calculator-state";

type CalculatorHistoryPanelProps = {
  entries: CalculatorHistoryEntry[];
  onClear: () => void;
  onSelect: (entry: CalculatorHistoryEntry) => void;
};

export function CalculatorHistoryPanel({
  entries,
  onClear,
  onSelect,
}: CalculatorHistoryPanelProps) {
  const { isPrivacyModeEnabled } = usePrivacyMode();

  return (
    <section aria-label="Histórico da calculadora" className="flex h-68 min-h-0 flex-col gap-2">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h3 className="font-medium text-muted-foreground text-sm">Histórico</h3>
        {entries.length > 0 ? (
          <Button
            className="-mr-2 text-muted-foreground"
            onClick={onClear}
            size="sm"
            type="button"
            variant="ghost"
          >
            Limpar histórico
          </Button>
        ) : null}
      </div>
      {entries.length === 0 ? (
        <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-6 text-center text-muted-foreground text-sm">
          Os cálculos feitos aqui aparecem nesta lista.
        </p>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1">
          {entries.map((entry) => {
            const result = formatCalculatorValue(entry.result);
            return (
              <li key={entry.id}>
                <button
                  aria-label={
                    isPrivacyModeEnabled
                      ? "Usar cálculo do histórico (valor oculto)"
                      : `Usar ${result}, de ${entry.expression}`
                  }
                  className="flex w-full min-w-0 flex-col items-end gap-0.5 rounded-lg px-3 py-2 text-right outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                  onClick={() => onSelect(entry)}
                  type="button"
                >
                  <span
                    className={cn(
                      "max-w-full truncate text-muted-foreground text-xs tabular-nums",
                      isPrivacyModeEnabled && "blur-sm select-none",
                    )}
                  >
                    {entry.expression}
                  </span>
                  <span
                    className={cn(
                      "max-w-full truncate font-heading font-medium text-lg tabular-nums",
                      isPrivacyModeEnabled && "blur-md select-none",
                    )}
                  >
                    {result}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
