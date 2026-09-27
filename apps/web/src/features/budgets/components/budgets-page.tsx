import type {
  BudgetOutput,
  CreateBudgetInput,
  UpdateBudgetInput,
} from "@openmonetis/validators/budgets";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Copy, Plus, RefreshCw, Tags, Target } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { buildFilterSlugMap } from "@/features/transactions/transactions.presentation";
import {
  useCreateBudgetMutation,
  useDeleteBudgetMutation,
  useUpdateBudgetMutation,
} from "../budgets.mutations";
import { budgetsQueryOptions } from "../budgets.queries";
import { BudgetCard } from "./budget-card";
import { BudgetDialog } from "./budget-dialog";
import { BudgetsSummary } from "./budgets-summary";
import { CopyBudgetsDialog } from "./copy-budgets-dialog";

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
  const categorySlugs = buildFilterSlugMap(categoriesQuery.data ?? []);
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

  async function saveBudget(input: CreateBudgetInput | UpdateBudgetInput) {
    if (editingBudget) {
      const updated = await updateMutation.mutateAsync({ id: editingBudget.id, input, period });
      toast.success("Orçamento atualizado");
      if (updated.period !== period) onPeriodChange(updated.period);
      return;
    }

    const created = await createMutation.mutateAsync(input as CreateBudgetInput);
    toast.success("Orçamento criado");
    if (created.period !== period) onPeriodChange(created.period);
  }

  async function removeBudget(budget: BudgetOutput) {
    try {
      await deleteMutation.mutateAsync({ id: budget.id, period });
      toast.success("Orçamento removido");
    } catch {
      toast.error("Não foi possível remover o orçamento.");
      throw new Error("Budget removal failed");
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
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
            description="Defina limites mensais e acompanhe o consumo por categoria."
            icon={<Target aria-hidden="true" className="size-5" />}
            title="Orçamentos"
          />

          <MonthNavigation
            className="sticky top-20 z-20"
            onPeriodChange={onPeriodChange}
            period={period}
          />

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
              <section aria-labelledby="budget-list-title" className="grid gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-lg" id="budget-list-title">
                      Limites por categoria
                    </h2>
                    <p className="text-muted-foreground text-sm">
                      {overview.items.length === 1
                        ? "1 categoria acompanhada"
                        : `${overview.items.length} categorias acompanhadas`}
                    </p>
                  </div>
                  <Button onClick={() => setCopyOpen(true)} type="button" variant="outline">
                    <Copy aria-hidden="true" className="size-4" />
                    Copiar limites do mês anterior
                  </Button>
                </div>
                {overview.items.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {overview.items.map((budget) => (
                      <BudgetCard
                        budget={budget}
                        categorySlug={categorySlugs.idToSlug.get(budget.categoryId)}
                        key={budget.id}
                        onEdit={(item) => {
                          setEditingBudget(item);
                          setDialogOpen(true);
                        }}
                        onRemove={removeBudget}
                        pending={
                          deleteMutation.isPending && deleteMutation.variables?.id === budget.id
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <BudgetsEmptyState expenseCategories={expenseCategories} onCreate={openCreate} />
                )}
              </section>
            </>
          ) : null}
        </section>
      </main>

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
            ? "Comece por uma categoria importante ou copie os limites do mês anterior."
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
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
