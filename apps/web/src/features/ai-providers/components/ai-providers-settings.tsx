import type { AiProvider, AiProviderStatus } from "@openmonetis/domain/ai-providers";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Plug, RefreshCw, Sparkles, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AiDataSharingSettings } from "@/features/ai-data-sharing/components/ai-data-sharing-settings";
import { aiToolsQueryOptions } from "@/features/ai-tools/ai-tools.queries";
import { AiToolVersion } from "@/features/ai-tools/components/ai-tool-version";
import { AiToolsFooter } from "@/features/ai-tools/components/ai-tools-footer";
import { cn } from "@/lib/utils";
import {
  useDisconnectAiProviderMutation,
  useUpdateAiProviderMutation,
} from "../ai-providers.mutations";
import {
  aiProviderErrorMessage,
  aiProviderLabels,
  aiProviderPlanDescriptions,
  aiProviderStatusLabels,
  formatAiProviderConnectedAt,
} from "../ai-providers.presentation";
import { aiProviderKeys, aiProvidersQueryOptions } from "../ai-providers.queries";
import { AiModelSelect } from "./ai-model-select";
import { AiProviderConnectDialog } from "./ai-provider-connect-dialog";
import { AiProviderMark } from "./ai-provider-mark";

export function AiProvidersSettings() {
  const client = useQueryClient();
  const query = useQuery(aiProvidersQueryOptions());
  // Only the installation admin gets the CLI versions; everyone else sees just the connections.
  const toolsQuery = useQuery({ ...aiToolsQueryOptions(), enabled: query.data?.enabled === true });
  const tools = toolsQuery.data?.allowed ? toolsQuery.data.items : [];
  const installing = tools.some((tool) => tool.job?.status === "pending");
  const disconnectMutation = useDisconnectAiProviderMutation();
  const updateMutation = useUpdateAiProviderMutation();
  const [connecting, setConnecting] = useState<AiProvider | null>(null);
  const [disconnecting, setDisconnecting] = useState<AiProvider | null>(null);

  function closeConnectDialog(open: boolean) {
    if (open) return;
    setConnecting(null);
    void client.invalidateQueries({ queryKey: aiProviderKeys.list() });
  }

  async function choosePreferredModel(provider: AiProvider, preferredModel: string | null) {
    try {
      await updateMutation.mutateAsync({ provider, preferredModel });
      toast.success("Modelo padrão atualizado");
    } catch (error) {
      toast.error(aiProviderErrorMessage(error));
    }
  }

  async function disconnect(provider: AiProvider) {
    try {
      await disconnectMutation.mutateAsync(provider);
      toast.success(`${aiProviderLabels[provider]} desconectado`);
      setDisconnecting(null);
    } catch (error) {
      toast.error(aiProviderErrorMessage(error));
    }
  }

  return (
    <>
      <SettingsSection
        contentClassName="grid gap-4"
        description="Conecte a sua própria assinatura. O uso conta no limite do seu plano, e o login é feito na página oficial de cada serviço."
        icon={Sparkles}
        title="Assistente de IA"
      >
        {query.isLoading ? (
          <div aria-label="Carregando conexões de IA" className="grid gap-2" role="status">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : null}
        {query.isError ? (
          <SettingsQueryError
            isRetrying={query.isFetching}
            message="Não foi possível carregar as conexões de IA."
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {query.data && !query.data.enabled ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-border p-5 text-muted-foreground">
            <Bot aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">
              A IA não está habilitada nesta instalação. Quem administra pode ativar o serviço de
              IA.
            </p>
          </div>
        ) : null}
        {query.data?.enabled ? (
          <>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {query.data.items.map((item) => {
                const tool = tools.find((candidate) => candidate.provider === item.provider);
                return (
                  <li
                    className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                    key={item.provider}
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <AiProviderMark provider={item.provider} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-sm">{aiProviderLabels[item.provider]}</p>
                          <ProviderStatus status={item.status} />
                        </div>
                        {item.status === "connected" && item.accountEmail ? (
                          <p
                            className="mt-1 truncate text-foreground/80 text-xs"
                            title={item.accountEmail}
                          >
                            <span className="sr-only">Conta conectada: </span>
                            {item.accountEmail}
                          </p>
                        ) : null}
                        {tool ? (
                          <AiToolVersion
                            canTestWithAccount={item.status === "connected"}
                            installing={installing}
                            tool={tool}
                          />
                        ) : null}
                        <p className="mt-1 text-muted-foreground text-xs leading-relaxed">
                          {item.status === "unavailable"
                            ? "O serviço de IA não respondeu. Verifique se ele está em execução."
                            : item.status === "connected" && item.consentedAt
                              ? `Conectado em ${formatAiProviderConnectedAt(item.consentedAt)}${
                                  item.models.length ? ` · ${item.models.length} modelos` : ""
                                }`
                              : aiProviderPlanDescriptions[item.provider]}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 sm:justify-end">
                      {item.status === "connected" ? (
                        <>
                          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)] sm:w-56 sm:flex-none">
                            <AiModelSelect
                              className="w-full min-w-0"
                              provider={item.provider}
                              disabled={updateMutation.isPending}
                              label={`Modelo padrão do ${aiProviderLabels[item.provider]}`}
                              models={item.models}
                              onValueChange={(model) =>
                                void choosePreferredModel(item.provider, model)
                              }
                              value={item.preferredModel}
                            />
                          </div>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={`Desconectar ${aiProviderLabels[item.provider]}`}
                              onClick={() => setDisconnecting(item.provider)}
                              render={
                                <Button
                                  className="text-muted-foreground hover:text-destructive"
                                  disabled={disconnectMutation.isPending}
                                  size="icon"
                                  type="button"
                                  variant="ghost"
                                />
                              }
                            >
                              <Unplug aria-hidden="true" />
                            </TooltipTrigger>
                            <TooltipContent>Desconectar</TooltipContent>
                          </Tooltip>
                        </>
                      ) : item.status === "unavailable" ? (
                        <Button
                          disabled={query.isFetching}
                          onClick={() => void query.refetch()}
                          type="button"
                          variant="outline"
                        >
                          <RefreshCw aria-hidden="true" />
                          {query.isFetching ? "Verificando…" : "Verificar"}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => setConnecting(item.provider)}
                          type="button"
                          variant="outline"
                        >
                          <Plug aria-hidden="true" /> Conectar
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted-foreground text-xs leading-relaxed">
              O modelo escolhido em cada assistente é o padrão dos diagnósticos e conversas e pode
              ser trocado a cada uso.
            </p>
            {tools.length ? <AiToolsFooter /> : null}
          </>
        ) : null}
        {connecting ? (
          <AiProviderConnectDialog
            key={connecting}
            onOpenChange={closeConnectDialog}
            open
            provider={connecting}
          />
        ) : null}

        <AlertDialog
          onOpenChange={(open) => {
            if (!open) setDisconnecting(null);
          }}
          open={disconnecting !== null}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Desconectar {disconnecting ? aiProviderLabels[disconnecting] : ""}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                O login será apagado do serviço de IA. Os diagnósticos já gerados continuam
                disponíveis.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={disconnectMutation.isPending}>
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={disconnectMutation.isPending}
                onClick={() => {
                  if (disconnecting) void disconnect(disconnecting);
                }}
              >
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SettingsSection>
      {query.data?.enabled ? <AiDataSharingSettings /> : null}
    </>
  );
}

const statusDotClassNames: Record<AiProviderStatus, string> = {
  connected: "bg-success",
  disconnected: "bg-muted-foreground/50",
  unavailable: "bg-warning",
};

function ProviderStatus({ status }: { status: AiProviderStatus }) {
  return (
    <Badge className="gap-1.5 font-mono" variant="outline">
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", statusDotClassNames[status])}
      />
      {aiProviderStatusLabels[status]}
    </Badge>
  );
}
