import type { BudgetOutput } from "@openmonetis/validators/budgets";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Plus, RefreshCw, Tags, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MonthNavigation } from "@/components/month-navigation";
import { AppShell } from "@/components/navigation/app-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { buildFilterSlugMap } from "@/features/transactions/transactions.presentation";
import {
  useCreateBudgetMutation,
  useDeleteBudgetMutation,
  useRepeatBudgetMutation,
  useStopBudgetRuleMutation,
  useUpdateBudgetMutation,
  useUpdateBudgetRuleMutation,
} from "../budgets.mutations";
import { formatBudgetCategoryCount, getBudgetWidgetItems } from "../budgets.presentation";
import { budgetsQueryOptions } from "../budgets.queries";
import { BudgetCard } from "./budget-card";
import { BudgetDialog, type BudgetDialogSubmission } from "./budget-dialog";
import { BudgetsSummary } from "./budgets-summary";
import { CopyBudgetsDialog } from "./copy-budgets-dialog";
import { PreviousBudgetsNotice } from "./previous-budgets-notice";
import { UnbudgetedExpenses } from "./unbudgeted-expenses";

const cardSkeletonKeys = ["first", "second", "third"] as const;

type BudgetsPageProps = {
  onPeriodChange: (period: string) => void;
  period: string;
};

export function BudgetsPage({ onPeriodChange, period }: BudgetsPageProps) {
  const budgetsQuery = useQuery(budgetsQueryOptions(period));
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const createMutation = useCreateBudgetMutation();
  const updateMutation = useUpdateBudgetMutation();
  const deleteMutation = useDeleteBudgetMutation();
  const repeatMutation = useRepeatBudgetMutation();
  const updateRuleMutation = useUpdateBudgetRuleMutation();
  const stopRuleMutation = useStopBudgetRuleMutation();
  const [pendingBudgetId, setPendingBudgetId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetOutput | null>(null);
  const [initialCategoryId, setInitialCategoryId] = useState<string | undefined>();
  const [copyOpen, setCopyOpen] = useState(false);
  const overview = budgetsQuery.data;
  const expenseCategories = (categoriesQuery.data ?? []).filter(
    (category) => category.type === "expense",
  );
  const budgetedCategoryIds = new Set(overview?.items.map((budget) => budget.categoryId));
  const availableCategories = expenseCategories.filter(
    (category) => !budgetedCategoryIds.has(category.id),
  );
  const categorySlugs = buildFilterSlugMap(
    (categoriesQuery.data ?? []).map((category) => ({
      ...category,
      name: getCategoryLabel(category),
    })),
  );
  const loading = budgetsQuery.isLoading || categoriesQuery.isLoading;
  const failed = budgetsQuery.isError || categoriesQuery.isError;

  function changeDialog(open: boolean) {
    setDialogOpen(open);
    if (!open) setEditingBudget(null);
  }

  function openCreate() {
    setInitialCategoryId(undefined);
    setEditingBudget(null);
    setDialogOpen(true);
  }

  async function saveBudget(submission: BudgetDialogSubmission) {
    if (submission.kind === "updateRule") {
      await updateRuleMutation.mutateAsync({ ruleId: submission.ruleId, input: submission.input });
      toast.success(
        submission.input.scope === "single" ? "Limite ajustado neste mês" : "Orçamento atualizado",
      );
      return;
    }
    if (submission.kind === "update" && editingBudget?.budgetId) {
      const updated = await updateMutation.mutateAsync({
        id: editingBudget.budgetId,
        input: submission.input,
        period,
      });
      toast.success("Orçamento atualizado");
      if (updated.period !== period) onPeriodChange(updated.period);
      return;
    }
    if (submission.kind !== "create") return;

    const created = await createMutation.mutateAsync(submission.input);
    toast.success(created.recurrence ? "Orçamento recorrente criado" : "Orçamento criado");
    if (created.period !== period) onPeriodChange(created.period);
  }

  async function runCardAction(budget: BudgetOutput, action: () => Promise<unknown>) {
    setPendingBudgetId(budget.id);
    try {
      await action();
    } finally {
      setPendingBudgetId(null);
    }
  }

  async function removeBudget(budget: BudgetOutput) {
    await runCardAction(budget, async () => {
      try {
        if (budget.recurrence) {
          await stopRuleMutation.mutateAsync({
            ruleId: budget.recurrence.ruleId,
            input: { period },
          });
          toast.success("Orçamento recorrente encerrado");
          return;
        }
        if (budget.budgetId) await deleteMutation.mutateAsync({ id: budget.budgetId, period });
        toast.success("Orçamento removido");
      } catch {
        toast.error(
          budget.recurrence
            ? "Não foi possível encerrar o orçamento."
            : "Não foi possível remover o orçamento.",
        );
        throw new Error("Budget removal failed");
      }
    });
  }

  function repeatBudget(budget: BudgetOutput) {
    if (!budget.budgetId) return;
    const budgetId = budget.budgetId;
    void runCardAction(budget, async () => {
      try {
        await repeatMutation.mutateAsync(budgetId);
        toast.success("Orçamento agora se repete todo mês");
      } catch {
        toast.error("Não foi possível repetir o orçamento.", {
          description: "A categoria pode já ter um orçamento recorrente em outro período.",
        });
      }
    });
  }

  function resetAdjustment(budget: BudgetOutput) {
    if (!budget.budgetId) return;
    const budgetId = budget.budgetId;
    void runCardAction(budget, async () => {
      try {
        await deleteMutation.mutateAsync({ id: budgetId, period });
        toast.success("Limite voltou ao valor recorrente");
      } catch {
        toast.error("Não foi possível voltar ao valor recorrente.");
      }
    });
  }

  return (
    <ProtectedRoute>
      <AppShell>
        <section className="app-page project-container">
          <PageHeader
            mobileFloatingAction
            actions={
              <Button
                disabled={loading || availableCategories.length === 0}
                onClick={openCreate}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" />
                Novo orçamento
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Finanças" },
              { label: "Orçamentos" },
            ]}
            description="Defina quanto pode gastar em cada categoria e acompanhe o que já usou no mês."
            icon={<Target aria-hidden="true" className="size-5" />}
            title="Orçamentos"
          />

          <MonthNavigation onPeriodChange={onPeriodChange} period={period} />

          {loading ? <BudgetsSkeleton /> : null}

          {failed ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar os orçamentos</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => {
                    void budgetsQuery.refetch();
                    void categoriesQuery.refetch();
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}

          {!loading && !failed && overview ? (
            <>
              {overview.items.length ? <BudgetsSummary overview={overview} /> : null}
              <section aria-labelledby="budget-list-title" className="grid gap-4">
                <div>
                  <h2 className="section-title" id="budget-list-title">
                    Limites por categoria
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {formatBudgetCategoryCount(overview.items.length)}
                  </p>
                </div>
                <PreviousBudgetsNotice
                  currentCategoryIds={overview.items.map((budget) => budget.categoryId)}
                  onOpen={() => setCopyOpen(true)}
                  period={period}
                />
                {overview.items.length > 0 ? (
                  <div className="stagger-children grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {getBudgetWidgetItems(overview.items).map((budget) => (
                      <BudgetCard
                        budget={budget}
                        categorySlug={categorySlugs.idToSlug.get(budget.categoryId)}
                        key={budget.id}
                        onEdit={(item) => {
                          setEditingBudget(item);
                          setDialogOpen(true);
                        }}
                        onRemove={removeBudget}
                        onRepeat={repeatBudget}
                        onResetAdjustment={resetAdjustment}
                        pending={pendingBudgetId === budget.id}
                      />
                    ))}
                  </div>
                ) : (
                  <BudgetsEmptyState expenseCategories={expenseCategories} onCreate={openCreate} />
                )}
              </section>
              <UnbudgetedExpenses
                key={period}
                overview={overview}
                categories={categoriesQuery.data ?? []}
                onCreate={(categoryId) => {
                  setInitialCategoryId(categoryId);
                  setEditingBudget(null);
                  setDialogOpen(true);
                }}
              />
            </>
          ) : null}
        </section>
      </AppShell>

      <BudgetDialog
        budget={editingBudget}
        initialCategoryId={initialCategoryId}
        categories={editingBudget ? [] : availableCategories}
        key={`${editingBudget?.id ?? initialCategoryId ?? "new"}-${period}-${dialogOpen ? "open" : "closed"}`}
        onOpenChange={changeDialog}
        onSubmit={saveBudget}
        open={dialogOpen}
        period={period}
      />

      <CopyBudgetsDialog
        currentCategoryIds={overview?.items.map((budget) => budget.categoryId) ?? []}
        key={period}
        onOpenChange={setCopyOpen}
        open={copyOpen}
        period={period}
      />
    </ProtectedRoute>
  );
}

function BudgetsEmptyState({
  expenseCategories,
  onCreate,
}: {
  expenseCategories: CategoryOutput[];
  onCreate: () => void;
}) {
  const hasExpenseCategories = expenseCategories.length > 0;

  return (
    <Card className="grid min-h-60 place-items-center border p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          {hasExpenseCategories ? (
            <Target aria-hidden="true" className="size-5" />
          ) : (
            <Tags aria-hidden="true" className="size-5" />
          )}
        </span>
        <p className="mt-4 font-medium">
          {hasExpenseCategories
            ? "Nenhum orçamento definido neste mês"
            : "Crie uma categoria de despesa primeiro"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {hasExpenseCategories
            ? "Comece por uma categoria importante. Os limites se repetem nos próximos meses."
            : "Os orçamentos são organizados por categoria de despesa."}
        </p>
        {hasExpenseCategories ? (
          <Button className="mt-4" onClick={onCreate} size="sm" type="button">
            <Plus aria-hidden="true" />
            Criar primeiro orçamento
          </Button>
        ) : (
          <Button asChild className="mt-4" size="sm" variant="outline">
            <Link to="/categories">Ir para categorias</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

function BudgetsSkeleton() {
  return (
    <div aria-label="Carregando orçamentos" className="grid gap-6" role="status">
      <Skeleton className="h-72 rounded-xl" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cardSkeletonKeys.map((key) => (
          <Skeleton className="h-64" key={key} />
        ))}
      </div>
      <span className="sr-only">Carregando…</span>
    </div>
  );
}
