import type { CategoryOutput } from "@openmonetis/validators/categories";
import type {
  CreateInboxRuleInput,
  InboxRuleOutput,
  ReplaceInboxRuleInput,
} from "@openmonetis/validators/inbox-rules";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, RefreshCw, Workflow } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useCreateInboxRuleMutation,
  useDeleteInboxRuleMutation,
  useReplaceInboxRuleMutation,
  useSetInboxRuleActiveMutation,
} from "../inbox-rules.mutations";
import { formatInboxRuleCount } from "../inbox-rules.presentation";
import { inboxRulesQueryOptions } from "../inbox-rules.queries";
import { InboxRuleCard } from "./inbox-rule-card";
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
      <DialogContent
        guarded
        className={cn(
          "flex max-h-[min(90vh,52rem)] min-w-0 flex-col overflow-hidden",
          view.kind === "form" ? "sm:max-w-2xl" : "sm:max-w-xl",
        )}
      >
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
                  ? "Sugira categoria e pessoa a partir das capturas. As regras são avaliadas por prioridade, da menor para a maior, e você sempre revisa antes de confirmar."
                  : "Defina as condições e os campos que serão sugeridos no lançamento."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div
          data-mobile-form-body
          className="min-h-0 flex-1 overflow-y-auto pr-3 scrollbar-gutter-stable"
        >
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-muted-foreground text-sm">
                  {query.data
                    ? formatInboxRuleCount(
                        query.data.items.length,
                        query.data.items.filter((rule) => rule.isActive).length,
                      )
                    : null}
                </p>
                <Button onClick={() => setView({ kind: "form", rule: null })} size="sm">
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
              {query.data?.items.map((rule) => (
                <InboxRuleCard
                  confirmingDelete={confirmDeleteId === rule.id}
                  deleting={deleteMutation.isPending}
                  key={rule.id}
                  onCancelDelete={() => setConfirmDeleteId(null)}
                  onConfirmDelete={() => void remove(rule)}
                  onEdit={() => setView({ kind: "form", rule })}
                  onRequestDelete={() => setConfirmDeleteId(rule.id)}
                  onToggle={(checked) => void toggle(rule, checked)}
                  rule={rule}
                  toggling={activeMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
