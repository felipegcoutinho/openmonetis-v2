import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalculatorDisplayProps = {
  copied: boolean;
  expression: string;
  history: string | null;
  onCopy: () => void;
  resultText: string | null;
};

export function CalculatorDisplay({
  copied,
  expression,
  history,
  onCopy,
  resultText,
}: CalculatorDisplayProps) {
  const expressionLength = expression.length;

  return (
    <div
      aria-live="polite"
      className="flex h-28 min-w-0 flex-col overflow-hidden rounded-xl border border-primary/25 bg-primary/15 px-5 py-4 text-right text-foreground dark:border-primary/20 dark:bg-primary/10"
    >
      <div className="flex min-h-5 items-center justify-between gap-3 text-muted-foreground text-xs">
        <span className="uppercase tracking-[0.12em]">Resultado</span>
        <span className="min-w-0 truncate">
          {history ?? <span aria-hidden="true">&nbsp;</span>}
        </span>
      </div>
      <div className="mt-auto flex min-w-0 items-end justify-end gap-2">
        <output
          className={cn(
            "min-w-0 whitespace-nowrap font-heading font-normal tracking-tight leading-none",
            expressionLength > 22
              ? "text-lg"
              : expressionLength > 17
                ? "text-xl"
                : expressionLength > 12
                  ? "text-2xl"
                  : history
                    ? "text-3xl"
                    : "text-4xl",
          )}
        >
          {expression}
        </output>
        {resultText ? (
          <Button
            aria-label={copied ? "Resultado copiado" : "Copiar resultado"}
            className="size-8 shrink-0 rounded-full text-muted-foreground hover:bg-brand/15 hover:text-foreground"
            onClick={onCopy}
            size="icon-xs"
            type="button"
            variant="ghost"
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
