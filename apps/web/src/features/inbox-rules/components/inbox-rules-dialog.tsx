import type { CategoryOutput } from "@openmonetis/validators/categories";
import type {
  CreateInboxRuleInput,
  InboxRuleOutput,
  ReplaceInboxRuleInput,
} from "@openmonetis/validators/inbox-rules";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Plus, RefreshCw, Trash2, Workflow } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  useCreateInboxRuleMutation,
  useDeleteInboxRuleMutation,
  useReplaceInboxRuleMutation,
  useSetInboxRuleActiveMutation,
} from "../inbox-rules.mutations";
import { describeInboxRuleActions, formatInboxRuleCondition } from "../inbox-rules.presentation";
import { inboxRulesQueryOptions } from "../inbox-rules.queries";
import { InboxRuleForm } from "./inbox-rule-form";

type View = { kind: "list" } | { kind: "form"; rule: InboxRuleOutput | null };

export function InboxRulesDialog({
  categories,
  onOpenChange,
  open,
  people,
}: {
  categories: CategoryOutput[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  people: PersonOutput[];
}) {
  const [view, setView] = useState<View>({ kind: "list" });
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const query = useQuery({ ...inboxRulesQueryOptions(), enabled: open });
  const createMutation = useCreateInboxRuleMutation();
  const replaceMutation = useReplaceInboxRuleMutation();
  const activeMutation = useSetInboxRuleActiveMutation();
  const deleteMutation = useDeleteInboxRuleMutation();

  function closeOrGoBack() {
    if (view.kind === "form") {
      setView({ kind: "list" });
      return;
    }
    onOpenChange(false);
  }

  async function save(input: CreateInboxRuleInput | ReplaceInboxRuleInput) {
    if (view.kind !== "form") return;
    if (view.rule) {
      await replaceMutation.mutateAsync({
        id: view.rule.id,
        input: input as ReplaceInboxRuleInput,
      });
    } else {
      await createMutation.mutateAsync(input as CreateInboxRuleInput);
    }
    setView({ kind: "list" });
  }

  async function toggle(rule: InboxRuleOutput, isActive: boolean) {
    try {
      await activeMutation.mutateAsync({
        id: rule.id,
        input: { expectedVersion: rule.version, isActive },
      });
      toast.success(isActive ? "Regra ativada" : "Regra pausada");
    } catch {
      toast.error("Não foi possível alterar a regra.");
    }
  }

  async function remove(rule: InboxRuleOutput) {
    try {
      await deleteMutation.mutateAsync({ id: rule.id, expectedVersion: rule.version });
      setConfirmDeleteId(null);
      toast.success("Regra excluída");
    } catch {
      toast.error("Não foi possível excluir a regra.");
    }
  }

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setView({ kind: "list" });
          setConfirmDeleteId(null);
        }
        onOpenChange(nextOpen);
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[min(90vh,52rem)] min-w-0 flex-col overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-start gap-2">
            {view.kind === "form" ? (
              <Button
                aria-label="Voltar para as regras"
                onClick={() => setView({ kind: "list" })}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : null}
            <div>
              <DialogTitle>
                {view.kind === "list"
                  ? "Regras da caixa de entrada"
                  : view.rule
                    ? "Editar regra"
                    : "Nova regra"}
              </DialogTitle>
              <DialogDescription>
                {view.kind === "list"
                  ? "Sugira categoria e pessoa conforme os dados capturados. Você sempre revisa antes de confirmar."
                  : "Defina as condições e os campos que serão sugeridos no lançamento."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {view.kind === "form" ? (
            <InboxRuleForm
              categories={categories}
              key={view.rule?.id ?? "new-rule"}
              onCancel={closeOrGoBack}
              onSubmit={save}
              people={people}
              rule={view.rule}
            />
          ) : (
            <div className="grid gap-4">
              <div className="flex justify-end">
                <Button onClick={() => setView({ kind: "form", rule: null })}>
                  <Plus aria-hidden="true" /> Nova regra
                </Button>
              </div>

              {query.isLoading ? (
                <div className="grid gap-3" role="status" aria-label="Carregando regras">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-28" />
                </div>
              ) : null}
              {query.isError ? (
                <Card>
                  <CardContent className="grid place-items-center py-10 text-center">
                    <p className="text-sm">Não foi possível carregar as regras.</p>
                    <Button className="mt-3" onClick={() => void query.refetch()} variant="outline">
                      <RefreshCw aria-hidden="true" /> Tentar novamente
                    </Button>
                  </CardContent>
                </Card>
              ) : null}
              {query.data && query.data.items.length === 0 ? (
                <Card>
                  <CardContent className="grid place-items-center py-12 text-center">
                    <span className="grid size-11 place-items-center rounded-full bg-muted">
                      <Workflow aria-hidden="true" className="size-5 text-muted-foreground" />
                    </span>
                    <p className="mt-3 font-medium">Nenhuma regra criada</p>
                    <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                      Crie uma regra para sugerir dados ao confirmar uma captura pendente.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
              {query.data?.items.map((rule) => {
                const confirmingDelete = confirmDeleteId === rule.id;
                return (
                  <Card className="py-0" key={rule.id}>
                    <CardContent className="grid gap-2.5 p-3">
                      <div className="flex items-center gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="break-words font-medium text-sm">{rule.name}</p>
                          <span className="text-muted-foreground text-[11px]">
                            Prioridade {rule.priority}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-0.5">
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={`Editar regra ${rule.name}`}
                              onClick={() => setView({ kind: "form", rule })}
                              render={
                                <Button
                                  className="text-muted-foreground hover:text-foreground"
                                  size="icon-xs"
                                  variant="ghost"
                                />
                              }
                            >
                              <Pencil aria-hidden="true" />
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              aria-label={`Excluir regra ${rule.name}`}
                              onClick={() => setConfirmDeleteId(rule.id)}
                              render={
                                <Button
                                  className="text-muted-foreground hover:text-destructive"
                                  size="icon-xs"
                                  variant="ghost"
                                />
                              }
                            >
                              <Trash2 aria-hidden="true" />
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                          <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
                          <span className="text-muted-foreground text-[11px]">
                            {rule.isActive ? "Ativa" : "Pausada"}
                          </span>
                          <Switch
                            aria-label={`${rule.isActive ? "Pausar" : "Ativar"} regra ${rule.name}`}
                            checked={rule.isActive}
                            disabled={activeMutation.isPending}
                            onCheckedChange={(checked) => void toggle(rule, checked)}
                          />
                        </div>
                      </div>
                      {confirmingDelete ? (
                        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2">
                          <p className="text-sm">Excluir esta regra?</p>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setConfirmDeleteId(null)}
                              size="sm"
                              variant="outline"
                            >
                              Cancelar
                            </Button>
                            <Button
                              disabled={deleteMutation.isPending}
                              onClick={() => void remove(rule)}
                              size="sm"
                              variant="destructive"
                            >
                              Excluir
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-1 rounded-md bg-muted/40 px-2.5 py-2 text-xs leading-5">
                          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
                            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                              Se
                            </span>
                            <p className="min-w-0 break-words">
                              <span className="text-muted-foreground">
                                {rule.matchMode === "all" ? "Todas: " : "Qualquer uma: "}
                              </span>
                              {rule.conditions.map(formatInboxRuleCondition).join(" · ")}
                            </p>
                          </div>
                          <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-2">
                            <span className="font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
                              Então
                            </span>
                            <p className="min-w-0 break-words">
                              Preencher {describeInboxRuleActions(rule)}
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
