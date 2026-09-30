import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
} from "@openmonetis/validators/categories";
import { useQuery } from "@tanstack/react-query";
import { Plus, Tags } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiClientError } from "@/lib/api-client";
import {
  useCreateCategoryMutation,
  useDeleteCategoryMutation,
  useReplaceCategoryMutation,
} from "../categories.mutations";
import { categoriesQueryOptions } from "../categories.queries";
import { CategoriesTable } from "./categories-table";
import { CategoryDialog } from "./category-dialog";

export function CategoriesPage() {
  const query = useQuery(categoriesQueryOptions());
  const create = useCreateCategoryMutation();
  const replace = useReplaceCategoryMutation();
  const remove = useDeleteCategoryMutation();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryOutput | null>(null);
  const categories = query.data ?? [];
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setEditing(null);
  }
  async function save(input: CreateCategoryInput | ReplaceCategoryInput) {
    if (editing)
      await replace.mutateAsync({ id: editing.id, input: input as ReplaceCategoryInput });
    else await create.mutateAsync(input as CreateCategoryInput);
    changeOpen(false);
  }
  async function deleteOne(category: CategoryOutput) {
    try {
      await remove.mutateAsync(category.id);
      toast.success("Categoria removida");
    } catch (error) {
      toast.error(
        error instanceof ApiClientError && error.code === "category_in_use"
          ? "Categoria em uso. Altere os lançamentos e remova os orçamentos vinculados antes de excluir."
          : "Não foi possível remover a categoria. Tente novamente.",
      );
    }
  }
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            actions={
              <Button onClick={() => setOpen(true)}>
                <Plus className="size-4" />
                Nova categoria
              </Button>
            }
            breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Organização" }]}
            description="Organize receitas e despesas para manter lançamentos e relatórios consistentes."
            eyebrow="Organização"
            icon={<Tags aria-hidden="true" className="size-5" />}
            title="Categorias"
          />
          <Input
            aria-label="Buscar categorias"
            placeholder="Buscar categoria"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {query.isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando categorias...</p>
          ) : null}
          {query.isError ? (
            <p className="text-destructive text-sm">Não foi possível carregar.</p>
          ) : null}
          {query.data ? (
            <Tabs className="min-w-0 gap-0" defaultValue="expense">
              <TabsList variant="line">
                <TabsTrigger value="expense">
                  Despesas ({categories.filter((item) => item.type === "expense").length})
                </TabsTrigger>
                <TabsTrigger value="income">
                  Receitas ({categories.filter((item) => item.type === "income").length})
                </TabsTrigger>
              </TabsList>
              {(["expense", "income"] as const).map((type) => {
                const items = categories.filter(
                  (item) =>
                    item.type === type &&
                    item.name
                      .toLocaleLowerCase("pt-BR")
                      .includes(search.toLocaleLowerCase("pt-BR")),
                );
                return (
                  <TabsContent className="min-w-0 pt-5" key={type} value={type}>
                    <Card className="min-w-0 gap-0 p-3 sm:p-4">
                      {items.length ? (
                        <div className="min-w-0 max-w-full overflow-x-auto">
                          <CategoriesTable
                            categories={items}
                            onEdit={(category) => {
                              setEditing(category);
                              setOpen(true);
                            }}
                            onRemove={deleteOne}
                            pendingId={remove.isPending ? remove.variables : null}
                          />
                        </div>
                      ) : (
                        <div className="grid min-h-52 place-items-center p-6 text-center">
                          <p className="text-muted-foreground text-sm">
                            Nenhuma categoria encontrada. Cadastre uma categoria ou revise a busca.
                          </p>
                        </div>
                      )}
                    </Card>
                  </TabsContent>
                );
              })}
            </Tabs>
          ) : null}
        </section>
      </main>
      <CategoryDialog category={editing} onOpenChange={changeOpen} onSubmit={save} open={open} />
    </ProtectedRoute>
  );
}
