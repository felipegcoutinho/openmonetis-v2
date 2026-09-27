import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { CreateGoalInput, GoalOutput, UpdateGoalInput } from "@openmonetis/validators/goals";
import { useQuery } from "@tanstack/react-query";
import { Goal, Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import {
  useCreateGoalMutation,
  useDeleteGoalMutation,
  useUpdateGoalMutation,
} from "../goals.mutations";
import { goalsQueryOptions } from "../goals.queries";
import { GoalCard } from "./goal-card";
import { GoalDialog } from "./goal-dialog";

const filters = [
  { value: "active", label: "Ativas" },
  { value: "completed", label: "Concluídas" },
  { value: "paused", label: "Pausadas" },
  { value: "archived", label: "Arquivadas" },
  { value: "all", label: "Todas" },
] as const;
type Filter = (typeof filters)[number]["value"];

export function GoalsPage() {
  const goalsQuery = useQuery(goalsQueryOptions());
  const accountsQuery = useQuery(accountsQueryOptions(getCurrentPeriodInBrazil()));
  const createMutation = useCreateGoalMutation();
  const updateMutation = useUpdateGoalMutation();
  const deleteMutation = useDeleteGoalMutation();
  const [filter, setFilter] = useState<Filter>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalOutput | null>(null);
  const goals = goalsQuery.data ?? [];
  const filtered = filter === "all" ? goals : goals.filter((goal) => goal.status === filter);
  const activeCount = goals.filter((goal) => goal.status === "active").length;
  const completedCount = goals.filter((goal) => goal.status === "completed").length;

  async function save(input: CreateGoalInput | UpdateGoalInput) {
    if (editingGoal) {
      await updateMutation.mutateAsync({ id: editingGoal.id, input });
      toast.success("Meta atualizada");
    } else {
      await createMutation.mutateAsync(input as CreateGoalInput);
      setFilter("active");
      toast.success("Meta criada");
    }
  }

  async function update(id: string, input: UpdateGoalInput) {
    try {
      await updateMutation.mutateAsync({ id, input });
      toast.success("Meta atualizada");
    } catch {
      toast.error("Não foi possível atualizar a meta.");
    }
  }

  async function remove(id: string) {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Meta excluída");
    } catch {
      toast.error("Não foi possível excluir a meta.");
      throw new Error("Goal deletion failed");
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
                onClick={() => {
                  setEditingGoal(null);
                  setDialogOpen(true);
                }}
                type="button"
              >
                <Plus aria-hidden="true" className="size-4" /> Nova meta
              </Button>
            }
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Finanças" },
              { label: "Metas" },
            ]}
            description="Defina objetivos de economia e acompanhe seu progresso."
            icon={<Goal aria-hidden="true" className="size-5" />}
            title="Metas"
          />

          {goalsQuery.isLoading ? (
            <div
              aria-label="Carregando metas"
              className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
              role="status"
            >
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
              <Skeleton className="h-64" />
            </div>
          ) : null}
          {goalsQuery.isError ? (
            <Card className="grid min-h-52 place-items-center border p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as metas</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => void goalsQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {goalsQuery.isSuccess ? (
            <>
              {goals.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-3">
                  <Card className="gap-1 border p-5">
                    <p className="text-muted-foreground text-sm">Metas ativas</p>
                    <p className="font-semibold text-3xl tabular-nums">{activeCount}</p>
                  </Card>
                  <Card className="gap-1 border p-5">
                    <p className="text-muted-foreground text-sm">Concluídas</p>
                    <p className="font-semibold text-3xl tabular-nums">{completedCount}</p>
                  </Card>
                  <Card className="gap-1 border p-5">
                    <p className="text-muted-foreground text-sm">Total de metas</p>
                    <p className="font-semibold text-3xl tabular-nums">{goals.length}</p>
                  </Card>
                </div>
              ) : null}
              <fieldset className="flex flex-wrap gap-2 border-0 p-0">
                <legend className="sr-only">Filtrar metas</legend>
                {filters.map((item) => (
                  <Button
                    aria-pressed={filter === item.value}
                    key={item.value}
                    onClick={() => setFilter(item.value)}
                    size="sm"
                    type="button"
                    variant={filter === item.value ? "default" : "outline"}
                  >
                    {item.label}
                  </Button>
                ))}
              </fieldset>
              {filtered.length > 0 ? (
                <section
                  aria-label="Lista de metas"
                  className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
                >
                  {filtered.map((goal) => (
                    <GoalCard
                      busy={
                        (updateMutation.isPending && updateMutation.variables?.id === goal.id) ||
                        (deleteMutation.isPending && deleteMutation.variables === goal.id)
                      }
                      goal={goal}
                      key={goal.id}
                      onEdit={(item) => {
                        setEditingGoal(item);
                        setDialogOpen(true);
                      }}
                      onRemove={remove}
                      onUpdate={update}
                    />
                  ))}
                </section>
              ) : (
                <Card className="grid min-h-60 place-items-center border p-6 text-center">
                  <div className="max-w-md">
                    <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
                      <Goal aria-hidden="true" className="size-5" />
                    </span>
                    <p className="mt-4 font-medium">
                      {goals.length === 0 ? "Nenhuma meta criada" : "Nenhuma meta neste filtro"}
                    </p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      {goals.length === 0
                        ? "Comece por um objetivo importante para você."
                        : "Escolha outro estado para ver suas metas."}
                    </p>
                    {goals.length === 0 ? (
                      <Button
                        className="mt-4"
                        onClick={() => {
                          setEditingGoal(null);
                          setDialogOpen(true);
                        }}
                        size="sm"
                        type="button"
                      >
                        <Plus aria-hidden="true" /> Criar primeira meta
                      </Button>
                    ) : null}
                  </div>
                </Card>
              )}
            </>
          ) : null}
        </section>
        <GoalDialog
          accounts={accountsQuery.data ?? []}
          accountsLoading={accountsQuery.isLoading}
          accountsError={accountsQuery.isError}
          goal={editingGoal}
          key={`${editingGoal?.id ?? "new"}-${dialogOpen ? "open" : "closed"}`}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setEditingGoal(null);
          }}
          onSubmit={save}
          open={dialogOpen}
        />
      </main>
    </ProtectedRoute>
  );
}
