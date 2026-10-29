import type { CreateTagInput, TagOutput } from "@openmonetis/validators/tags";
import { useQuery } from "@tanstack/react-query";
import { Plus, Tag } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  useCreateTagMutation,
  useDeleteTagMutation,
  useUpdateTagMutation,
} from "../tags.mutations";
import { tagsQueryOptions, tagsReportQueryOptions } from "../tags.queries";
import { TagDialog } from "./tag-dialog";
import { TagsList } from "./tags-list";
export function TagsPage({
  period,
  onPeriodChange,
}: {
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagOutput | null>(null);
  const [removing, setRemoving] = useState<TagOutput | null>(null);
  const query = useQuery(tagsQueryOptions());
  const report = useQuery(tagsReportQueryOptions(period));
  const create = useCreateTagMutation();
  const update = useUpdateTagMutation();
  const remove = useDeleteTagMutation();
  const tags = query.data ?? [];
  const visibleTags = tags.filter((tag) =>
    tag.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  async function save(input: CreateTagInput) {
    if (editing) await update.mutateAsync({ id: editing.id, input });
    else await create.mutateAsync(input);
    setOpen(false);
  }
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container min-w-0">
          <PageHeader
            title="Etiquetas"
            eyebrow="Organização"
            icon={<Tag className="size-5" aria-hidden="true" />}
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Organização" },
              { label: "Etiquetas" },
            ]}
            description="Cruze seus lançamentos por assuntos, projetos ou atividades."
            actions={
              <Button
                onClick={() => {
                  setEditing(null);
                  setOpen(true);
                }}
              >
                <Plus aria-hidden="true" />
                Nova etiqueta
              </Button>
            }
          />
          {tags.length ? (
            <>
              <MonthNavigation onPeriodChange={onPeriodChange} period={period} />
              <div className="flex flex-wrap gap-3">
                <Input
                  className="min-w-0 flex-1"
                  aria-label="Buscar etiquetas"
                  placeholder="Buscar etiqueta"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <p className="text-muted-foreground text-sm">
                Resultado é a diferença entre receitas e despesas do mês, incluindo pendências.
                Transferências mostram o valor movimentado entre contas, contado uma vez por
                transferência, sem afetar o resultado. Um lançamento pode aparecer em mais de uma
                etiqueta; os totais das etiquetas não devem ser somados.
              </p>
            </>
          ) : null}
          {query.isLoading ? <p role="status">Carregando etiquetas...</p> : null}
          {query.isError ? (
            <p role="alert" className="text-destructive">
              Não foi possível carregar as etiquetas.{" "}
              <Button variant="link" onClick={() => void query.refetch()}>
                Tentar novamente
              </Button>
            </p>
          ) : null}
          {report.isError ? (
            <p role="alert" className="text-destructive text-sm">
              Não foi possível carregar os totais.{" "}
              <Button variant="link" onClick={() => void report.refetch()}>
                Tentar novamente
              </Button>
            </p>
          ) : null}
          {query.data ? (
            visibleTags.length ? (
              <TagsList
                tags={visibleTags}
                period={period}
                report={report.data}
                loading={report.isPending}
                onEdit={(tag) => {
                  setEditing(tag);
                  setOpen(true);
                }}
                onRemove={setRemoving}
              />
            ) : (
              <Card className="items-center gap-3 p-6 text-center" role="status">
                <Tag aria-hidden="true" className="size-6 text-muted-foreground" />
                <p className="font-medium">
                  {tags.length ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta cadastrada"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {tags.length
                    ? "Tente outro nome ou limpe a busca para ver todas as etiquetas."
                    : "Crie sua primeira etiqueta para organizar os lançamentos."}
                </p>
                {search.trim() ? (
                  <Button variant="outline" onClick={() => setSearch("")}>
                    Limpar busca
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      setEditing(null);
                      setOpen(true);
                    }}
                  >
                    <Plus aria-hidden="true" />
                    Nova etiqueta
                  </Button>
                )}
              </Card>
            )
          ) : null}
        </section>
      </main>
      <TagDialog open={open} onOpenChange={setOpen} tag={editing} onSubmit={save} />
      <AlertDialog
        open={Boolean(removing)}
        onOpenChange={(next) => {
          if (!next && !remove.isPending) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              A etiqueta será retirada de todos os lançamentos e recorrências. Os lançamentos serão
              preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={remove.isPending}
              onClick={async (event) => {
                event.preventDefault();
                if (!removing) return;
                try {
                  await remove.mutateAsync(removing.id);
                  setRemoving(null);
                  toast.success("Etiqueta excluída");
                } catch {
                  toast.error("Não foi possível excluir a etiqueta.");
                }
              }}
            >
              {remove.isPending ? "Excluindo..." : "Excluir etiqueta"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}
