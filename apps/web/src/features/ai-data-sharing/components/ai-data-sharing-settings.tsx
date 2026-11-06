import {
  type AiDataScope,
  aiDataScopes,
  isFullAiDataSharing,
  normalizeAiDataScopes,
} from "@openmonetis/domain/ai-data-sharing";
import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { AiDataSharingOutput } from "@openmonetis/validators/ai-data-sharing";
import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { useId } from "react";
import { toast } from "sonner";
import { SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useUpdateAiDataSharingMutation } from "../ai-data-sharing.mutations";
import {
  aiDataScopeOptions,
  aiDataSharingErrorMessage,
  isAiDataScopeLocked,
} from "../ai-data-sharing.presentation";
import { aiDataSharingQueryOptions } from "../ai-data-sharing.queries";
import { AiDataHistorySettings } from "./ai-data-history-settings";
import { AiDataPreviewDialog } from "./ai-data-preview-dialog";

export function AiDataSharingSettings() {
  const query = useQuery(aiDataSharingQueryOptions());

  return (
    <>
      <SettingsSection
        contentClassName="grid gap-4"
        description="Totais do mês, indicadores e valores por categoria sempre são enviados. Libere mais dados para análises mais específicas."
        icon={ShieldCheck}
        title="Permissões de dados"
      >
        {query.isLoading ? (
          <Skeleton aria-label="Carregando permissões" className="h-56" role="status" />
        ) : null}
        {query.isError ? (
          <SettingsQueryError
            isRetrying={query.isFetching}
            message="Não foi possível carregar as permissões de dados."
            onRetry={() => void query.refetch()}
          />
        ) : null}
        {query.data ? (
          <AiDataSharingForm initial={query.data} key={query.data.updatedAt ?? "default"} />
        ) : null}
      </SettingsSection>
      {query.data ? <AiDataHistorySettings sharing={query.data} /> : null}
    </>
  );
}

function AiDataSharingForm({ initial }: { initial: AiDataSharingOutput }) {
  const mutation = useUpdateAiDataSharingMutation();
  const baseId = useId();
  const form = useForm({
    defaultValues: { scopes: initial.scopes },
    onSubmit: async ({ value }) => {
      try {
        const saved = await mutation.mutateAsync({ scopes: value.scopes });
        toast.success(
          saved.isFull ? "Todos os dados liberados para o assistente" : "Permissões salvas",
        );
      } catch (error) {
        toast.error(aiDataSharingErrorMessage(error));
      }
    },
  });

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="scopes">
        {(field) => {
          const scopes = field.state.value;
          const isFull = isFullAiDataSharing(scopes);
          const setScopes = (next: AiDataScope[]) =>
            field.handleChange(normalizeAiDataScopes(next));
          const toggle = (scope: AiDataScope, checked: boolean) =>
            setScopes(checked ? [...scopes, scope] : scopes.filter((item) => item !== scope));

          return (
            <>
              <div className="rounded-lg border border-border">
                <div className="flex items-start gap-3 border-border border-b bg-muted/30 px-4 py-3">
                  <Checkbox
                    checked={isFull}
                    id={`${baseId}-all`}
                    indeterminate={!isFull && scopes.length > 0}
                    onCheckedChange={(checked) => setScopes(checked ? [...aiDataScopes] : [])}
                  />
                  <Label className="grid gap-0.5 font-normal" htmlFor={`${baseId}-all`}>
                    <span className="flex items-center gap-2 font-mono font-medium text-sm">
                      Liberar todos os dados
                      <span className="font-mono font-normal text-muted-foreground text-xs tabular-nums">
                        {scopes.length}/{aiDataScopes.length}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">
                      Envia ao assistente tudo o que está listado abaixo.
                    </span>
                  </Label>
                </div>
                <ul className="grid gap-1 p-2 sm:grid-cols-2">
                  {aiDataScopes.map((scope) => {
                    const locked = isAiDataScopeLocked(scope, scopes);
                    const description = locked
                      ? "Disponível ao liberar os lançamentos do mês."
                      : aiDataScopeOptions[scope].description;
                    const id = `${baseId}-${scope}`;
                    return (
                      <li key={scope}>
                        <Label
                          className={cn(
                            "flex min-w-0 items-start gap-3 rounded-md p-2 font-normal transition-colors",
                            locked
                              ? "cursor-not-allowed opacity-60"
                              : "cursor-pointer hover:bg-muted/50",
                          )}
                          htmlFor={id}
                        >
                          <Checkbox
                            checked={scopes.includes(scope)}
                            disabled={locked}
                            id={id}
                            onCheckedChange={(checked) => toggle(scope, checked === true)}
                          />
                          <span className="grid min-w-0 gap-0.5">
                            <span className="font-mono text-sm">
                              {aiDataScopeOptions[scope].label}
                            </span>
                            <span
                              className="truncate text-muted-foreground text-xs"
                              title={description}
                            >
                              {description}
                            </span>
                          </span>
                        </Label>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <PrivacyNotice isFull={isFull} scopes={scopes} />
            </>
          );
        }}
      </form.Field>

      <form.Subscribe selector={(state) => [state.isDirty, state.isSubmitting] as const}>
        {([isDirty, isSubmitting]) => (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <AiDataPreviewDialog period={getCurrentPeriodInBrazil()} />
            <div className="flex flex-wrap items-center justify-end gap-2">
              <span aria-live="polite" className="text-muted-foreground text-xs">
                {isDirty ? "Alterações não salvas" : null}
              </span>
              {isDirty ? (
                <Button
                  disabled={isSubmitting}
                  onClick={() => form.reset()}
                  type="button"
                  variant="ghost"
                >
                  Descartar
                </Button>
              ) : null}
              <Button disabled={!isDirty || isSubmitting} type="submit">
                {isSubmitting ? "Salvando…" : "Salvar permissões"}
              </Button>
            </div>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function PrivacyNotice({ isFull, scopes }: { isFull: boolean; scopes: AiDataScope[] }) {
  if (!scopes.length) {
    return (
      <p className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-muted-foreground text-xs leading-relaxed">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand-strong" />
        Modo mais privado: nenhum nome, descrição ou anotação sai do OpenMonetis.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {isFull ? (
        <p
          className="flex items-start gap-2 rounded-lg bg-warning/10 p-3 text-muted-foreground text-xs leading-relaxed"
          role="alert"
        >
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            <span className="font-medium text-foreground">Todos os dados liberados. </span>
            Lançamentos, pessoas, anotações, contas, orçamentos e metas vão ao assistente a cada
            diagnóstico e conversa.
          </span>
        </p>
      ) : null}
      <ul className="grid list-disc gap-1 rounded-lg bg-muted/50 py-3 pr-3 pl-8 text-muted-foreground text-xs leading-relaxed">
        <li>Vai para o assistente escolhido (Claude, ChatGPT ou Antigravity) pela sua conta.</li>
        <li>Segue a política de privacidade do seu plano, inclusive o uso para treino.</li>
        <li>
          A telemetria das ferramentas fica desligada; no Antigravity ela é uma opção da conta
          Google.
        </li>
        <li>Arquivos anexados nunca são enviados.</li>
        <li>Desmarcar não apaga do provedor o que já foi enviado.</li>
      </ul>
    </div>
  );
}
