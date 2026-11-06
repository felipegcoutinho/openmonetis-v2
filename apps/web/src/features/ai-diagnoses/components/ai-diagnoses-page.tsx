import { type AiDiagnosisVoice, defaultAiDiagnosisVoice } from "@openmonetis/domain/ai-diagnoses";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type { AiDiagnosisSummaryOutput } from "@openmonetis/validators/ai-diagnoses";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Gauge, History, MessagesSquare, Plug, RefreshCw, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AiChatPanel } from "@/features/ai-chats/components/ai-chat-panel";
import { AiDataPreviewDialog } from "@/features/ai-data-sharing/components/ai-data-preview-dialog";
import { aiProvidersQueryOptions } from "@/features/ai-providers/ai-providers.queries";
import { AiModelSelect } from "@/features/ai-providers/components/ai-model-select";
import { AiProviderMark } from "@/features/ai-providers/components/ai-provider-mark";
import { AiProviderSelect } from "@/features/ai-providers/components/ai-provider-select";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import {
  useCancelAiDiagnosisMutation,
  useCreateAiDiagnosisMutation,
  useDeleteAiDiagnosisMutation,
} from "../ai-diagnoses.mutations";
import {
  type AiDiagnosesTab,
  aiDiagnosisChangeErrorMessage,
  aiDiagnosisCreateErrorMessage,
  aiDiagnosisStatusLabel,
  aiDiagnosisVoiceLabels,
  financialHealthLevelLabels,
  formatDiagnosisDate,
  formatDiagnosisModel,
} from "../ai-diagnoses.presentation";
import { aiDiagnosesQueryOptions, aiDiagnosisQueryOptions } from "../ai-diagnoses.queries";
import { AiDiagnosisReport } from "./ai-diagnosis-report";
import { AiDiagnosisVoiceSelect } from "./ai-diagnosis-voice-select";

type AiDiagnosesPageProps = {
  period: string;
  diagnosisId?: string;
  tab: AiDiagnosesTab;
  chatId?: string;
  onPeriodChange: (period: string) => void;
  onDiagnosisChange: (diagnosisId: string | undefined) => void;
  onTabChange: (tab: AiDiagnosesTab) => void;
  onChatChange: (chatId: string | undefined) => void;
};

export function AiDiagnosesPage({
  period,
  diagnosisId,
  tab,
  chatId,
  onPeriodChange,
  onDiagnosisChange,
  onTabChange,
  onChatChange,
}: AiDiagnosesPageProps) {
  const providersQuery = useQuery(aiProvidersQueryOptions());
  const diagnosesQuery = useQuery(aiDiagnosesQueryOptions());
  const createMutation = useCreateAiDiagnosisMutation();
  const cancelMutation = useCancelAiDiagnosisMutation();
  const deleteMutation = useDeleteAiDiagnosisMutation();
  const [deleting, setDeleting] = useState<AiDiagnosisSummaryOutput | null>(null);
  const [chosenProvider, setChosenProvider] = useState<AiProvider | null>(null);
  const [chosenVoice, setVoice] = useState<AiDiagnosisVoice | null>(null);
  const [chosenModel, setChosenModel] = useState<{
    provider: AiProvider;
    model: string | null;
  } | null>(null);
  const providerItems = providersQuery.data?.items ?? [];
  const connectedItems = providerItems.filter((item) => item.status === "connected");
  const providerItem =
    connectedItems.find((item) => item.provider === chosenProvider) ?? connectedItems[0] ?? null;
  const provider = providerItem?.provider ?? null;
  // The preferred model from Ajustes is the starting point; a choice here applies to this page only.
  const model =
    chosenModel && chosenModel.provider === provider
      ? chosenModel.model
      : providerItem?.models.some((item) => item.id === providerItem.preferredModel)
        ? providerItem.preferredModel
        : null;
  // Until a voice is picked here, the last diagnosis' voice is kept.
  const voice = chosenVoice ?? diagnosesQuery.data?.items[0]?.voice ?? defaultAiDiagnosisVoice;
  const selectedId =
    diagnosisId ?? diagnosesQuery.data?.items.find((item) => item.period === period)?.id;
  const diagnosisQuery = useQuery({
    ...aiDiagnosisQueryOptions(selectedId ?? ""),
    enabled: Boolean(selectedId),
  });
  const diagnosis = diagnosisQuery.data;
  const isRunning = createMutation.isPending || diagnosis?.status === "pending";
  // A new run never replaces the shown one; it becomes the latest entry in the history.
  const hasResultForPeriod = diagnosis?.status === "completed" && diagnosis.period === period;

  async function generate() {
    if (!provider) return;
    try {
      const created = await createMutation.mutateAsync({ period, provider, model, voice });
      onDiagnosisChange(created.id);
      if (hasResultForPeriod)
        toast.success("Novo diagnóstico iniciado. O anterior fica no histórico.");
    } catch (error) {
      toast.error(aiDiagnosisCreateErrorMessage(error));
    }
  }

  async function stop(id: string) {
    try {
      await cancelMutation.mutateAsync(id);
      toast.success("Análise parada");
    } catch (error) {
      toast.error(aiDiagnosisChangeErrorMessage(error));
    }
  }

  async function remove(item: AiDiagnosisSummaryOutput) {
    try {
      await deleteMutation.mutateAsync(item.id);
      if (item.id === diagnosisId) onDiagnosisChange(undefined);
      toast.success("Diagnóstico apagado");
      setDeleting(null);
    } catch (error) {
      toast.error(aiDiagnosisChangeErrorMessage(error));
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Diagnóstico com IA" },
            ]}
            description="Indicadores, gráficos e próximos passos sobre a sua saúde financeira, e um chat para tirar dúvidas sobre os seus números."
            actions={
              connectedItems.length > 0 ? (
                <AiDataPreviewDialog period={period} showSettingsLink />
              ) : null
            }
            icon={<Sparkles aria-hidden="true" className="size-5" />}
            title="Diagnóstico com IA"
          />

          {/* An open chat keeps the month it was started with; a new chat uses the month chosen here. */}
          {tab === "chat" && chatId ? null : (
            <MonthNavigation onPeriodChange={onPeriodChange} period={period} />
          )}

          {/* Same layout as the tags and inbox pages: tabs on the left, options of the view on the right. */}
          <Tabs
            className="gap-0"
            onValueChange={(value) => onTabChange(value as AiDiagnosesTab)}
            value={tab}
          >
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:border-border lg:border-b">
              <TabsList
                aria-label="Diagnóstico com IA"
                className="lg:h-13! lg:border-b-0"
                variant="line"
              >
                <TabsTrigger value="diagnosis">
                  <Gauge aria-hidden="true" />
                  Diagnóstico
                </TabsTrigger>
                <TabsTrigger value="chat">
                  <MessagesSquare aria-hidden="true" />
                  Conversar
                </TabsTrigger>
              </TabsList>

              {providerItem && tab === "diagnosis" ? (
                <fieldset
                  aria-label="Gerar novo diagnóstico"
                  className="grid min-w-0 shrink-0 grid-cols-2 gap-2 sm:flex sm:items-center"
                >
                  {connectedItems.length > 1 ? (
                    <AiProviderSelect
                      className="w-full sm:w-auto"
                      disabled={isRunning}
                      onValueChange={setChosenProvider}
                      providers={connectedItems.map((item) => item.provider)}
                      size="sm"
                      value={providerItem.provider}
                    />
                  ) : null}
                  <AiModelSelect
                    className="w-full sm:w-auto sm:max-w-56"
                    disabled={isRunning}
                    label="Modelo"
                    models={providerItem.models}
                    onValueChange={(next) =>
                      setChosenModel({ provider: providerItem.provider, model: next })
                    }
                    provider={providerItem.provider}
                    showProviderMark={connectedItems.length === 1}
                    size="sm"
                    value={model}
                  />
                  <AiDiagnosisVoiceSelect
                    className={cn("w-full sm:w-auto", connectedItems.length > 1 && "col-span-2")}
                    disabled={isRunning}
                    onValueChange={setVoice}
                    size="sm"
                    value={voice}
                  />
                  <Button
                    className="col-span-2 sm:ml-1"
                    disabled={isRunning}
                    onClick={() => void generate()}
                    size="sm"
                    type="button"
                  >
                    <Sparkles aria-hidden="true" />
                    {isRunning
                      ? "Gerando…"
                      : hasResultForPeriod
                        ? "Gerar novo"
                        : "Gerar diagnóstico"}
                  </Button>
                </fieldset>
              ) : null}
            </div>
          </Tabs>

          {tab === "chat" && providersQuery.data && connectedItems.length > 0 ? (
            <AiChatPanel
              chatId={chatId}
              connectedProviders={connectedItems}
              onChatChange={onChatChange}
              period={period}
            />
          ) : null}
          {tab === "chat" && providersQuery.data && !connectedItems.length ? (
            <ConnectProviderCard enabled={providersQuery.data.enabled} />
          ) : null}
          {tab === "chat" && providersQuery.isLoading ? (
            <Skeleton className="h-[calc(100svh-8rem)] min-h-[40rem] w-full" />
          ) : null}

          {tab === "diagnosis" ? (
            <>
              {providersQuery.isLoading || diagnosesQuery.isLoading ? (
                <div className="grid gap-4" role="status" aria-label="Carregando diagnóstico">
                  <Skeleton className="h-40 w-full" />
                  <Skeleton className="h-64 w-full" />
                </div>
              ) : null}

              {providersQuery.data && !connectedItems.length ? (
                <ConnectProviderCard enabled={providersQuery.data.enabled} />
              ) : null}

              {connectedItems.length > 0 && !selectedId && diagnosesQuery.data ? (
                <Card className="grid min-h-56 place-items-center p-6 text-center">
                  <div className="grid max-w-md justify-items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand-strong">
                      <Sparkles aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium">Nenhum diagnóstico para {formatPeriod(period)}</p>
                      <p className="mt-1 text-muted-foreground text-sm leading-relaxed">
                        Gere um diagnóstico para receber uma análise dos seus números, com pontos de
                        atenção e sugestões de próximos passos.
                      </p>
                    </div>
                    <Button disabled={isRunning} onClick={() => void generate()} type="button">
                      <Sparkles aria-hidden="true" />
                      {isRunning ? "Gerando…" : "Gerar diagnóstico"}
                    </Button>
                  </div>
                </Card>
              ) : null}

              {selectedId && diagnosisQuery.isLoading ? <Skeleton className="h-64 w-full" /> : null}
              {diagnosisQuery.isError ? (
                <Card className="grid justify-items-center gap-3 p-6 text-center text-sm">
                  <p role="alert">Não foi possível carregar o diagnóstico.</p>
                  <Button
                    disabled={diagnosisQuery.isFetching}
                    onClick={() => void diagnosisQuery.refetch()}
                    size="sm"
                    type="button"
                    variant="outline"
                  >
                    <RefreshCw aria-hidden="true" />
                    {diagnosisQuery.isFetching ? "Tentando…" : "Tentar novamente"}
                  </Button>
                </Card>
              ) : null}
              {diagnosis ? (
                <AiDiagnosisReport
                  diagnosis={diagnosis}
                  isRetrying={isRunning}
                  isStopping={cancelMutation.isPending}
                  onRetry={() => void generate()}
                  onStop={() => void stop(diagnosis.id)}
                />
              ) : null}

              {diagnosesQuery.data?.items.length ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <History aria-hidden="true" className="size-4" />
                      Diagnósticos recentes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="divide-y divide-border">
                      {diagnosesQuery.data.items.map((item) => (
                        <li className="flex items-center gap-1" key={item.id}>
                          <button
                            aria-current={item.id === selectedId ? "true" : undefined}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-md px-2 py-3 text-left text-sm outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50",
                              item.id === selectedId && "bg-muted/60",
                            )}
                            onClick={() => {
                              if (item.period !== period) onPeriodChange(item.period);
                              onDiagnosisChange(item.id);
                            }}
                            type="button"
                          >
                            <AiProviderMark provider={item.provider} size={24} />
                            <span className="min-w-0 flex-1">
                              <span className="block font-medium">{formatPeriod(item.period)}</span>
                              <span className="block font-mono text-muted-foreground text-xs">
                                {formatDiagnosisModel(item.provider, item.model)} ·{" "}
                                {aiDiagnosisVoiceLabels[item.voice]} ·{" "}
                                {formatDiagnosisDate(item.createdAt)}
                              </span>
                            </span>
                            <Badge
                              className="font-mono"
                              variant={
                                item.status === "failed" && item.failureCode !== "canceled"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {aiDiagnosisStatusLabel(item.status, item.failureCode) ??
                                `${item.score} · ${financialHealthLevelLabels[item.level]}`}
                            </Badge>
                          </button>
                          <Button
                            aria-label={`Apagar diagnóstico de ${formatPeriod(item.period)}`}
                            className="shrink-0 text-muted-foreground hover:text-destructive"
                            disabled={deleteMutation.isPending}
                            onClick={() => setDeleting(item)}
                            size="icon"
                            title="Apagar"
                            type="button"
                            variant="ghost"
                          >
                            <Trash2 aria-hidden="true" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </>
          ) : null}

          <AlertDialog
            onOpenChange={(open) => {
              if (!open) setDeleting(null);
            }}
            open={deleting !== null}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Apagar este diagnóstico?</AlertDialogTitle>
                <AlertDialogDescription>
                  {deleting?.status === "pending"
                    ? "A análise em andamento será parada e o diagnóstico sairá do histórico."
                    : "O diagnóstico sairá do histórico e não poderá ser recuperado."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  disabled={deleteMutation.isPending}
                  onClick={() => {
                    if (deleting) void remove(deleting);
                  }}
                  variant="destructive"
                >
                  Apagar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </section>
      </main>
    </ProtectedRoute>
  );
}

function ConnectProviderCard({ enabled }: { enabled: boolean }) {
  return (
    <Card className="grid min-h-56 place-items-center p-6 text-center">
      <div className="grid max-w-md justify-items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-brand/10 text-brand-strong">
          <Plug aria-hidden="true" className="size-5" />
        </span>
        {enabled ? (
          <>
            <p className="font-medium">Conecte sua assinatura de IA</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Use sua conta do Claude, do ChatGPT (Codex) ou do Google (Antigravity) para gerar
              diagnósticos. O uso conta no limite do seu próprio plano.
            </p>
            <Button asChild>
              <Link search={{ tab: "integrations" }} to="/settings">
                Conectar em Ajustes
              </Link>
            </Button>
          </>
        ) : (
          <>
            <p className="font-medium">IA não habilitada</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Esta instalação ainda não ativou o serviço de IA. Fale com quem administra o
              OpenMonetis.
            </p>
          </>
        )}
      </div>
    </Card>
  );
}
