import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Clipboard, FileBraces } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriod } from "@/lib/period-presentation";
import { formatAiDataPreview, formatSharedScopes } from "../ai-data-sharing.presentation";
import { aiDataPreviewQueryOptions } from "../ai-data-sharing.queries";

/** Shows, before anything is sent, the exact data object a diagnosis or chat of `period` sends. */
export function AiDataPreviewDialog({
  period,
  showSettingsLink = false,
  size = "default",
}: {
  period: string;
  showSettingsLink?: boolean;
  size?: "sm" | "default";
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)} size={size} type="button" variant="outline">
        <FileBraces aria-hidden="true" />
        Ver dados enviados
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="grid max-h-[calc(100svh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-5 sm:max-w-2xl">
          <DialogHeader className="pr-10">
            <DialogTitle>Dados enviados ao assistente</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Exatamente o que um diagnóstico ou uma conversa de {formatPeriod(period)} envia agora,
              com as permissões salvas. Além disto, só seguem as instruções do OpenMonetis e, no
              chat, as mensagens da conversa.
            </DialogDescription>
          </DialogHeader>
          {open ? <AiDataPreviewBody period={period} /> : null}
          <DialogFooter>
            {showSettingsLink ? (
              <Button asChild variant="outline">
                <Link search={{ tab: "integrations" }} to="/settings">
                  Alterar permissões
                </Link>
              </Button>
            ) : null}
            <Button onClick={() => setOpen(false)} type="button">
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AiDataPreviewBody({ period }: { period: string }) {
  const query = useQuery(aiDataPreviewQueryOptions(period));

  if (query.isLoading) {
    return <Skeleton aria-label="Montando a prévia" className="h-72" role="status" />;
  }
  if (!query.data) {
    return (
      <p className="text-muted-foreground text-sm" role="alert">
        Não foi possível montar a prévia. Tente novamente.
      </p>
    );
  }

  const { text, size } = formatAiDataPreview(query.data.data);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Prévia copiada");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  return (
    <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Badge className="font-mono" variant="secondary">
          {size}
        </Badge>
        <p className="min-w-0 flex-1 text-muted-foreground text-xs first-letter:uppercase">
          {formatSharedScopes(query.data.scopes)}
        </p>
        <Button
          className="-mr-2"
          onClick={() => void copy()}
          size="sm"
          type="button"
          variant="ghost"
        >
          <Clipboard aria-hidden="true" />
          Copiar
        </Button>
      </div>
      <pre className="min-h-0 overflow-auto rounded-lg border bg-muted/40 px-4 py-3.5 font-mono text-xs leading-relaxed">
        {text}
      </pre>
    </div>
  );
}
