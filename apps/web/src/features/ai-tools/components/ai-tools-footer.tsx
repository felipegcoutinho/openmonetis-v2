import { History } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AiToolHistoryDialog } from "./ai-tool-history-dialog";

/** How tool versions are vetted, plus the full change history; only for the installation admin. */
export function AiToolsFooter() {
  const [historyOpen, setHistoryOpen] = useState(false);
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-xs leading-relaxed">
        Versões novas vêm da origem oficial, com pelo menos 3 dias de publicação, e só são ativadas
        depois de conferir a assinatura e passar no teste. A versão original fica de reserva.
      </p>
      <Button
        className="self-start sm:self-auto"
        onClick={() => setHistoryOpen(true)}
        size="sm"
        type="button"
        variant="outline"
      >
        <History aria-hidden="true" />
        Histórico de mudanças
      </Button>
      <AiToolHistoryDialog onOpenChange={setHistoryOpen} open={historyOpen} />
    </div>
  );
}
