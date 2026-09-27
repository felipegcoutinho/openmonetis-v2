import type {
  AttachmentListItemOutput,
  ListAttachmentsQuery,
} from "@openmonetis/validators/attachments";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { FileSearch, Loader2, Paperclip, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
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
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDeleteAttachmentMutation } from "../attachments.mutations";
import { type AttachmentsSearch, getCurrentAttachmentPeriod } from "../attachments.presentation";
import { attachmentsQueryOptions } from "../attachments.queries";
import { AttachmentCard } from "./attachment-card";
import { AttachmentLibraryFilters } from "./attachment-library-filters";
import { AttachmentPreviewDialog } from "./attachment-preview-dialog";

type AttachmentsPageProps = {
  search: AttachmentsSearch;
  onSearchChange: (search: Partial<AttachmentsSearch>) => void;
};

const skeletonKeys = ["one", "two", "three", "four", "five", "six", "seven", "eight"];

export function AttachmentsPage({ search, onSearchChange }: AttachmentsPageProps) {
  const period = search.period ?? getCurrentAttachmentPeriod();
  const queryInput = {
    period,
    q: search.q,
    kind: search.kind,
    personId: search.personId,
    page: search.page ?? 1,
    pageSize: 20,
  } satisfies ListAttachmentsQuery;
  const query = useQuery(attachmentsQueryOptions(queryInput));
  const remove = useDeleteAttachmentMutation();
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState<AttachmentListItemOutput | null>(
    null,
  );
  const data = query.data;
  const previewIndex = data?.items.findIndex((attachment) => attachment.id === previewId) ?? -1;
  const hasFilters = Boolean(search.q || search.kind || search.personId);

  async function removeAttachment() {
    if (!removingAttachment) return;

    try {
      await remove.mutateAsync(removingAttachment.id);
      toast.success("Anexo excluído");
      if (previewId === removingAttachment.id) setPreviewId(null);
      const currentPage = search.page ?? 1;
      if (data?.items.length === 1 && currentPage > 1) {
        onSearchChange({ page: currentPage - 1 });
      }
      setRemovingAttachment(null);
    } catch {
      toast.error("Não foi possível excluir o anexo.");
    }
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Organização" },
              { label: "Anexos" },
            ]}
            description="Encontre comprovantes e documentos dos lançamentos do mês selecionado."
            icon={<Paperclip aria-hidden="true" className="size-5" />}
            title="Anexos"
          />

          <MonthNavigation
            className="sticky top-20 z-20"
            onPeriodChange={(nextPeriod) => onSearchChange({ period: nextPeriod, page: undefined })}
            period={period}
          />

          {query.isLoading ? <AttachmentsSkeleton /> : null}

          {query.isError ? (
            <Card className="grid min-h-60 place-items-center border p-6 text-center">
              <div>
                <TriangleAlert
                  aria-hidden="true"
                  className="mx-auto size-8 text-muted-foreground"
                />
                <p className="mt-3 font-medium">Não foi possível carregar os anexos</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => void query.refetch()}
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

          {data ? (
            <section
              aria-busy={query.isFetching}
              aria-labelledby="attachment-list-title"
              className="grid gap-4"
            >
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-lg" id="attachment-list-title">
                    Documentos do mês
                  </h2>
                  <p className="text-muted-foreground text-sm">
                    {data.total === 1 ? "1 anexo encontrado" : `${data.total} anexos encontrados`}
                    {query.isPlaceholderData ? (
                      <span className="ml-2 inline-flex items-center gap-1" role="status">
                        <Loader2 aria-hidden="true" className="size-3 animate-spin" />
                        Atualizando
                      </span>
                    ) : null}
                    {data.total > 0 ? (
                      <span>
                        {" "}
                        · Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))}
                      </span>
                    ) : null}
                  </p>
                </div>
                <AttachmentLibraryFilters
                  counts={data.counts}
                  onSearchChange={onSearchChange}
                  people={data.people}
                  search={search}
                />
              </div>

              {data.items.length ? (
                <div
                  className={cn(
                    "grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                    query.isPlaceholderData && "opacity-60",
                  )}
                >
                  {data.items.map((attachment) => (
                    <AttachmentCard
                      attachment={attachment}
                      key={attachment.id}
                      onPreview={() => setPreviewId(attachment.id)}
                      onRemove={() => setRemovingAttachment(attachment)}
                    />
                  ))}
                </div>
              ) : (
                <AttachmentsEmptyState
                  hasFilters={hasFilters}
                  onClear={() =>
                    onSearchChange({
                      q: undefined,
                      kind: undefined,
                      personId: undefined,
                      page: undefined,
                    })
                  }
                />
              )}

              {data.total > data.pageSize ? (
                <nav
                  aria-label="Paginação de anexos"
                  className="flex items-center justify-center gap-2"
                >
                  <Button
                    disabled={data.page <= 1}
                    onClick={() => onSearchChange({ page: data.page - 1 || undefined })}
                    type="button"
                    variant="outline"
                  >
                    Anterior
                  </Button>
                  <Button
                    disabled={data.page * data.pageSize >= data.total}
                    onClick={() => onSearchChange({ page: data.page + 1 })}
                    type="button"
                    variant="outline"
                  >
                    Próxima
                  </Button>
                </nav>
              ) : null}
            </section>
          ) : null}
        </section>
      </main>

      {data && previewIndex >= 0 ? (
        <AttachmentPreviewDialog
          attachments={data.items}
          initialIndex={previewIndex}
          key={previewId}
          onOpenChange={(open) => {
            if (!open) setPreviewId(null);
          }}
          open
        />
      ) : null}

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemovingAttachment(null);
        }}
        open={Boolean(removingAttachment)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Excluir este anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mb-2 block break-all font-medium text-foreground">
                {removingAttachment?.fileName}
              </span>
              <span>
                {removingAttachment?.linkedTransactionCount === 1
                  ? "O arquivo será removido do lançamento e não poderá ser recuperado."
                  : `O arquivo será removido de ${removingAttachment?.linkedTransactionCount ?? 0} lançamentos e não poderá ser recuperado.`}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              onClick={() => void removeAttachment()}
              variant="destructive"
            >
              {remove.isPending ? "Excluindo..." : "Excluir anexo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  );
}

function AttachmentsEmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <Card className="grid min-h-64 place-items-center border p-6 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-muted text-muted-foreground">
          {hasFilters ? (
            <FileSearch aria-hidden="true" className="size-5" />
          ) : (
            <Paperclip aria-hidden="true" className="size-5" />
          )}
        </span>
        <p className="mt-4 font-medium">
          {hasFilters ? "Nenhum anexo encontrado" : "Nenhum anexo neste mês"}
        </p>
        <p className="mt-1 text-muted-foreground text-sm">
          {hasFilters
            ? "Ajuste ou limpe os filtros para ver outros documentos."
            : "Adicione comprovantes aos lançamentos para encontrá-los organizados aqui."}
        </p>
        {!hasFilters ? (
          <Button asChild className="mt-4">
            <Link to="/transactions">Abrir lançamentos</Link>
          </Button>
        ) : null}
        {hasFilters && (
          <Button className="mt-4" onClick={onClear} size="sm" type="button" variant="outline">
            Limpar filtros
          </Button>
        )}
      </div>
    </Card>
  );
}

function AttachmentsSkeleton() {
  return (
    <div aria-label="Carregando anexos" className="grid gap-4" role="status">
      <Skeleton className="h-9 w-full rounded-lg sm:ml-auto sm:w-96" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {skeletonKeys.map((key) => (
          <Skeleton className="aspect-4/3 rounded-xl" key={key} />
        ))}
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
