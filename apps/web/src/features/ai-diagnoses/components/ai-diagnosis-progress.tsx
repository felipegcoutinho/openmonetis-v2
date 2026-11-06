import type { AiDataScope } from "@openmonetis/domain/ai-data-sharing";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { Check, Circle, LoaderCircle, Square } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { formatSharedScopes } from "@/features/ai-data-sharing/ai-data-sharing.presentation";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { cn } from "@/lib/utils";
import { aiDiagnosisExpectedDurations, formatElapsedTime } from "../ai-diagnoses.presentation";

type StepState = "done" | "active" | "waiting";

/** Seconds since `since`, ticking every second; the server clock may be slightly ahead. */
function useElapsedSeconds(since: string) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);
  return Math.max(0, Math.floor((now - start) / 1_000));
}

export function AiDiagnosisProgress({
  createdAt,
  isStopping,
  modelLabel,
  onStop,
  provider,
  sharedScopes,
}: {
  createdAt: string;
  isStopping: boolean;
  modelLabel: string;
  onStop: () => void;
  provider: AiProvider;
  sharedScopes: readonly AiDataScope[];
}) {
  const elapsed = useElapsedSeconds(createdAt);
  const expected = aiDiagnosisExpectedDurations[provider];
  const steps: Array<{ key: string; title: ReactNode; description: string; state: StepState }> = [
    {
      key: "indicators",
      title: "Indicadores calculados",
      description: "Pontuação, reserva e tendências foram calculadas pelo OpenMonetis.",
      state: "done",
    },
    {
      key: "analysis",
      title: (
        <>
          <AiProviderMark className="mr-1.5 align-[-0.2em]" provider={provider} size={16} />
          {modelLabel} está escrevendo a análise
        </>
      ),
      description: sharedScopes.length
        ? `Dados enviados: ${formatSharedScopes(sharedScopes)}, conforme suas permissões.`
        : "Somente totais e indicadores foram enviados. Nomes, descrições e anotações ficam no OpenMonetis.",
      state: "active",
    },
    {
      key: "report",
      title: "Montar o relatório",
      description: "Validar a resposta e separar os gráficos e atalhos sugeridos.",
      state: "waiting",
    },
  ];

  return (
    <Card aria-busy="true" className="py-4">
      <CardContent className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="grid gap-1">
            <CardTitle className="flex items-center gap-2 text-base" role="status">
              <LoaderCircle aria-hidden="true" className="size-4 shrink-0 animate-spin" />
              {isStopping ? "Parando a análise…" : "Gerando seu diagnóstico"}
            </CardTitle>
            <p className="text-muted-foreground text-xs leading-relaxed">
              {elapsed < expected.slowAfterSeconds
                ? `Costuma levar ${expected.label}. Você pode sair desta página; a análise continua.`
                : "Está levando mais que o normal. A análise é encerrada automaticamente após 5 minutos."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-medium font-mono text-muted-foreground text-sm tabular-nums">
              <span className="sr-only">Tempo decorrido: </span>
              {formatElapsedTime(elapsed)}
            </span>
            <Button
              disabled={isStopping}
              onClick={onStop}
              size="sm"
              type="button"
              variant="outline"
            >
              <Square aria-hidden="true" className="fill-current" />
              {isStopping ? "Parando…" : "Parar análise"}
            </Button>
          </div>
        </div>

        <ol className="grid gap-3">
          {steps.map((step) => (
            <li className="flex gap-3" key={step.key}>
              <StepIcon state={step.state} />
              <div className="grid gap-0.5">
                <p
                  className={cn(
                    "font-medium text-sm",
                    step.state === "waiting" && "text-muted-foreground",
                  )}
                >
                  {step.title}
                </p>
                <p className="text-muted-foreground text-xs leading-relaxed">{step.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function StepIcon({ state }: { state: StepState }) {
  const className = "grid size-6 shrink-0 place-items-center rounded-full";
  if (state === "done") {
    return (
      <span className={cn(className, "bg-brand/10 text-brand-strong")}>
        <Check aria-hidden="true" className="size-3.5" />
        <span className="sr-only">Concluído</span>
      </span>
    );
  }
  if (state === "active") {
    return (
      <span className={cn(className, "bg-brand/10 text-brand-strong")}>
        <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
        <span className="sr-only">Em andamento</span>
      </span>
    );
  }
  return (
    <span className={cn(className, "bg-muted text-muted-foreground")}>
      <Circle aria-hidden="true" className="size-2.5" />
      <span className="sr-only">Aguardando</span>
    </span>
  );
}
