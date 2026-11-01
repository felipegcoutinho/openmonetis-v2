import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <div className="flex h-28 min-w-0 flex-col overflow-hidden rounded-lg border bg-muted/50 px-4 pt-2.5 pb-4 text-right text-foreground">
      <div className="flex min-h-8 items-center justify-between gap-3">
        {resultText ? (
          <Tooltip>
            <TooltipTrigger
              aria-label={copied ? "Resultado copiado" : "Copiar resultado"}
              render={
                <Button
                  className={cn(
                    "-ml-1.5 shrink-0 text-muted-foreground hover:bg-background hover:text-foreground",
                    copied && "text-success hover:text-success",
                  )}
                  onClick={onCopy}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </TooltipTrigger>
            <TooltipContent>{copied ? "Copiado" : "Copiar resultado"}</TooltipContent>
          </Tooltip>
        ) : (
          <span aria-hidden="true" />
        )}
        <span className="min-w-0 truncate text-muted-foreground text-sm tabular-nums">
          {history}
        </span>
      </div>
      <output
        aria-live="polite"
        className={cn(
          "mt-auto min-w-0 truncate whitespace-nowrap font-heading font-medium leading-none tracking-tight tabular-nums",
          expressionLength > 22
            ? "text-lg"
            : expressionLength > 17
              ? "text-xl"
              : expressionLength > 12
                ? "text-2xl"
                : "text-4xl",
        )}
      >
        {expression}
      </output>
    </div>
  );
}
