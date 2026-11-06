import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { useState } from "react";
import { Streamdown } from "streamdown";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * AI Elements `Reasoning`, adapted: open while the model is thinking, collapsed afterwards unless
 * the person opens it.
 */
export function Reasoning({
  className,
  isStreaming,
  children,
}: {
  className?: string;
  isStreaming: boolean;
  children: string;
}) {
  const [chosenOpen, setChosenOpen] = useState<boolean | null>(null);
  const isOpen = chosenOpen ?? isStreaming;

  return (
    <Collapsible className={cn("not-prose", className)} onOpenChange={setChosenOpen} open={isOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <BrainIcon aria-hidden="true" className="size-4" />
        {isStreaming ? (
          <span className="animate-pulse">Pensando…</span>
        ) : (
          <span>Raciocínio do modelo</span>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn("size-4 transition-transform", isOpen && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 border-border border-l-2 pl-3 text-muted-foreground text-sm">
        <Streamdown>{children}</Streamdown>
      </CollapsibleContent>
    </Collapsible>
  );
}
