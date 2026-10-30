import type { CreateTagInput, TagOutput } from "@openmonetis/validators/tags";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Tag } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateTagMutation,
  useDeleteTagMutation,
  useUpdateTagMutation,
} from "../tags.mutations";
import { tagsQueryOptions, tagsReportQueryOptions } from "../tags.queries";
import { TagDialog } from "./tag-dialog";
import { TagsList } from "./tags-list";

type TagStatus = TagOutput["status"];

export function TagsPage({
  period,
  onPeriodChange,
}: {
  period: string;
  onPeriodChange: (period: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TagStatus>("active");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<TagOutput | null>(null);
  const [removing, setRemoving] = useState<TagOutput | null>(null);
  const query = useQuery(tagsQueryOptions());
  const report = useQuery(tagsReportQueryOptions(period));
  const create = useCreateTagMutation();
  const update = useUpdateTagMutation();
  const remove = useDeleteTagMutation();
  const tags = query.data ?? [];
  const statusCounts = {
    active: tags.filter((tag) => tag.status === "active").length,
    inactive: tags.filter((tag) => tag.status === "inactive").length,
  };
  const visibleTags = tags.filter(
    (tag) =>
      tag.status === status &&
      tag.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")),
  );
  async function toggleStatus(tag: TagOutput) {
    const nextStatus: TagStatus = tag.status === "active" ? "inactive" : "active";
    try {
      await update.mutateAsync({ id: tag.id, input: { status: nextStatus } });
      toast.success(nextStatus === "inactive" ? "Etiqueta inativada" : "Etiqueta reativada", {
        description:
          nextStatus === "inactive"
            ? "Ela some dos seletores, mas continua nos lançamentos."
            : "Ela voltou a aparecer nos seletores.",
        action: {
          label: "Desfazer",
          onClick: () =>
            update.mutate(
              { id: tag.id, input: { status: tag.status } },
              { onError: () => toast.error("Não foi possível desfazer.") },
            ),
        },
      });
    } catch {
      toast.error("Não foi possível alterar a etiqueta.");
    }
  }
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
              <Tabs
                className="gap-0"
                onValueChange={(value) => {
                  if (value === "active" || value === "inactive") setStatus(value);
                }}
                value={status}
              >
                <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:border-border lg:border-b">
                  <TabsList
                    aria-label="Filtrar por status"
                    className="lg:border-b-0"
                    variant="line"
                  >
                    <TabsTrigger value="active">Ativas ({statusCounts.active})</TabsTrigger>
                    <TabsTrigger value="inactive">
                      {statusCounts.inactive ? `Inativas (${statusCounts.inactive})` : "Inativas"}
                    </TabsTrigger>
                  </TabsList>
                  <div className="relative min-w-0 sm:w-72">
                    <Search
                      aria-hidden="true"
                      className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      className="h-8 pl-9"
                      aria-label="Buscar etiquetas"
                      placeholder="Buscar etiqueta"
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </div>
                </div>
              </Tabs>
            </>
          ) : null}
          {query.isLoading ? (
            <div aria-label="Carregando etiquetas" className="grid gap-2" role="status">
              <Skeleton className="h-10" />
              <Skeleton className="h-40" />
            </div>
          ) : null}
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
              <div className="grid gap-2">
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
                  onToggleStatus={(tag) => void toggleStatus(tag)}
                  pendingTagId={update.isPending ? (update.variables?.id ?? null) : null}
                />
                <p className="text-muted-foreground text-xs leading-relaxed">
                  Resultado é receitas menos despesas do mês, incluindo pendências. Transferências
                  não afetam o resultado. Um lançamento pode ter várias etiquetas, então os totais
                  não devem ser somados.
                </p>
              </div>
            ) : (
              <Card className="items-center gap-3 p-6 text-center" role="status">
                <Tag aria-hidden="true" className="size-6 text-muted-foreground" />
                <p className="font-medium">
                  {!tags.length
                    ? "Nenhuma etiqueta cadastrada"
                    : search.trim()
                      ? "Nenhuma etiqueta encontrada"
                      : status === "inactive"
                        ? "Nenhuma etiqueta inativa"
                        : "Nenhuma etiqueta ativa"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {!tags.length
                    ? "Crie sua primeira etiqueta para organizar os lançamentos."
                    : search.trim()
                      ? "Tente outro nome ou limpe a busca para ver todas as etiquetas."
                      : status === "inactive"
                        ? "Etiquetas inativadas aparecem aqui e podem ser reativadas."
                        : "Reative uma etiqueta ou crie uma nova."}
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
