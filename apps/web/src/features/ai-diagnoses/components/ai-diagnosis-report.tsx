import type { AiDiagnosisSectionTone } from "@openmonetis/domain/ai-diagnoses";
import type { AiDiagnosisOutput } from "@openmonetis/validators/ai-diagnoses";
import {
  ChartNoAxesCombined,
  CircleAlert,
  CircleCheck,
  CircleStop,
  FileText,
  Gauge,
  Info,
  type LucideIcon,
  OctagonAlert,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatSharedScopes } from "@/features/ai-data-sharing/ai-data-sharing.presentation";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { cn } from "@/lib/utils";
import {
  aiDiagnosisFailureMessage,
  aiDiagnosisToneClassNames,
  aiDiagnosisToneLabels,
  aiDiagnosisVoiceLabels,
  financialHealthLevelClassNames,
  financialHealthLevelLabels,
  formatDiagnosisDate,
  formatDiagnosisModel,
  formatMonthsIndicator,
  formatPercentIndicator,
} from "../ai-diagnoses.presentation";
import { AiDiagnosisActions } from "./ai-diagnosis-actions";
import { AiDiagnosisCharts } from "./ai-diagnosis-charts";
import { AiDiagnosisProgress } from "./ai-diagnosis-progress";

/** Each tone has its own shape, so the section reads right without telling colors apart. */
const toneIcons: Record<AiDiagnosisSectionTone, LucideIcon> = {
  positive: CircleCheck,
  neutral: Info,
  attention: TriangleAlert,
  critical: OctagonAlert,
};

type AiDiagnosisReportProps = {
  diagnosis: AiDiagnosisOutput;
  isRetrying: boolean;
  isStopping: boolean;
  onRetry: () => void;
  onStop: () => void;
};

export function AiDiagnosisReport({
  diagnosis,
  isRetrying,
  isStopping,
  onRetry,
  onStop,
}: AiDiagnosisReportProps) {
  const wasCanceled = diagnosis.failureCode === "canceled";
  const { health, result } = diagnosis;
  const modelLabel = formatDiagnosisModel(
    diagnosis.provider,
    diagnosis.model,
    diagnosis.requestedModel,
  );

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
        <HealthScore diagnosis={diagnosis} />
        <HealthIndicators indicators={health.indicators} />
      </div>

      {diagnosis.status === "pending" ? (
        <AiDiagnosisProgress
          createdAt={diagnosis.createdAt}
          isStopping={isStopping}
          modelLabel={modelLabel}
          onStop={onStop}
          provider={diagnosis.provider}
          sharedScopes={diagnosis.sharedScopes}
        />
      ) : null}

      {diagnosis.status === "failed" ? (
        <Card className={cn(!wasCanceled && "border-destructive/30 bg-destructive/5")}>
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm" role={wasCanceled ? "status" : "alert"}>
              {wasCanceled ? (
                <CircleStop
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                />
              ) : (
                <CircleAlert
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-destructive"
                />
              )}
              {aiDiagnosisFailureMessage(diagnosis.failureCode)}
            </p>
            <Button
              disabled={isRetrying}
              onClick={onRetry}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" />
              Gerar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {result ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText aria-hidden="true" className="size-4 shrink-0" />
                {result.headline}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-6">
              <p className="whitespace-pre-line text-sm leading-relaxed">{result.summary}</p>
              <div className="grid gap-5">
                {result.sections.map((section) => {
                  const ToneIcon = toneIcons[section.tone];
                  return (
                    <section className="grid gap-1.5" key={section.title}>
                      <h3 className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-medium text-sm">
                        <ToneIcon
                          aria-hidden="true"
                          className={cn("size-4 shrink-0", aiDiagnosisToneClassNames[section.tone])}
                        />
                        {section.title}
                        <span
                          className={cn(
                            "eyebrow font-normal",
                            aiDiagnosisToneClassNames[section.tone],
                          )}
                        >
                          {aiDiagnosisToneLabels[section.tone]}
                        </span>
                      </h3>
                      <p className="whitespace-pre-line pl-6 text-muted-foreground text-sm leading-relaxed">
                        {section.body}
                      </p>
                    </section>
                  );
                })}
              </div>
              <div className="flex items-start gap-2.5 border-border border-t pt-4 text-muted-foreground text-xs">
                <AiProviderMark provider={diagnosis.provider} size={20} />
                <p className="leading-relaxed">
                  Gerado por{" "}
                  <span className="font-medium font-mono text-foreground">{modelLabel}</span> em{" "}
                  {formatDiagnosisDate(diagnosis.completedAt ?? diagnosis.createdAt)}, no estilo{" "}
                  {aiDiagnosisVoiceLabels[diagnosis.voice]}. Dados enviados:{" "}
                  {formatSharedScopes(diagnosis.sharedScopes)}. Os números vêm do OpenMonetis; o
                  texto é uma interpretação e não substitui orientação profissional.
                </p>
              </div>
            </CardContent>
          </Card>
          <AiDiagnosisCharts charts={health.charts} kinds={result.charts} />
          <AiDiagnosisActions actions={result.actions} period={diagnosis.period} />
        </>
      ) : null}
    </div>
  );
}

function HealthScore({ diagnosis }: { diagnosis: AiDiagnosisOutput }) {
  const { score, level } = diagnosis.health;

  return (
    <Card className="py-4">
      <CardContent className="grid gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge aria-hidden="true" className="size-4 shrink-0" />
          Saúde financeira
        </CardTitle>
        <p className="flex items-baseline gap-2">
          <span className="font-mono font-semibold text-5xl tabular-nums tracking-tight">
            {score}
          </span>
          <span className="font-mono text-muted-foreground text-sm">/ 100</span>
        </p>
        <Progress aria-label={`Pontuação ${score} de 100`} value={score} />
        <p className={cn("font-medium text-sm", financialHealthLevelClassNames[level])}>
          {financialHealthLevelLabels[level]}
        </p>
      </CardContent>
    </Card>
  );
}

function HealthIndicators({
  indicators,
}: {
  indicators: AiDiagnosisOutput["health"]["indicators"];
}) {
  const items = [
    {
      label: "Poupança no mês",
      value: formatPercentIndicator(indicators.savingsRate),
      hint: "Parte da receita que sobrou",
    },
    {
      label: "Poupança média",
      value: formatPercentIndicator(indicators.averageSavingsRate),
      hint: "Últimos seis meses",
    },
    {
      label: "Reserva",
      value: formatMonthsIndicator(indicators.emergencyFundMonths),
      hint: "Saldo em contas ÷ despesa média",
    },
    {
      label: "Tendência das despesas",
      value: formatPercentIndicator(indicators.expenseTrend, true),
      hint: "Três meses recentes vs. anteriores",
    },
    {
      label: "Maior categoria",
      value: formatPercentIndicator(indicators.topCategoryShare),
      hint: "Peso nas despesas do mês",
    },
    {
      label: "Alertas",
      value: `${indicators.criticalAttentionItems} críticos · ${indicators.warningAttentionItems} avisos`,
      hint: "Faturas, contas e orçamentos",
    },
  ];

  return (
    <Card className="py-4">
      <CardContent className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        <CardTitle className="flex items-center gap-2 text-base sm:col-span-2 xl:col-span-3">
          <ChartNoAxesCombined aria-hidden="true" className="size-4 shrink-0" />
          Indicadores financeiros
        </CardTitle>
        {items.map((item) => (
          <div className="min-w-0" key={item.label}>
            <p className="eyebrow text-muted-foreground">{item.label}</p>
            <p className="mt-1 font-medium font-mono text-base tabular-nums">{item.value}</p>
            <p className="mt-0.5 text-muted-foreground text-xs">{item.hint}</p>
          </div>
        ))}
        {indicators.averageMonthlyExpenses !== null ? (
          <div className="min-w-0 sm:col-span-2 xl:col-span-3">
            <p className="text-muted-foreground text-xs">
              Despesa média mensal:{" "}
              <MoneyValue
                amount={indicators.averageMonthlyExpenses}
                className="font-medium font-mono"
              />
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
