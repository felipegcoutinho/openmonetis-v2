import type { AttachmentOutput } from "@openmonetis/validators/attachments";
import { useQuery } from "@tanstack/react-query";
import { FileImage, FileText, Loader2, Paperclip, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { type DragEvent, useId, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDetachNoteAttachmentMutation,
  useUploadNoteAttachmentMutation,
} from "@/features/attachments/attachments.mutations";
import {
  attachmentAccept,
  attachmentTypeLabel,
  formatFileSize,
  maximumAttachmentSizeMb,
  validateAttachmentFile,
} from "@/features/attachments/attachments.presentation";
import { noteAttachmentsQueryOptions } from "@/features/attachments/attachments.queries";
import { AttachmentImage } from "@/features/attachments/components/attachment-image";
import { AttachmentPreviewDialog } from "@/features/attachments/components/attachment-preview-dialog";
import { useAttachmentUrl } from "@/features/attachments/useAttachmentUrl";
import { useClipboardFiles } from "@/features/attachments/useClipboardFiles";
import { cn } from "@/lib/utils";
import { formatAttachmentCount } from "../notes.presentation";

type NoteAttachmentsProps = {
  noteId: string;
  readOnly?: boolean;
  /** Hides the whole section when there is nothing to show and nothing can be added. */
  hideWhenEmpty?: boolean;
};

type UploadingFile = { key: string; file: File };

const tileClassName =
  "group/tile relative aspect-square min-w-0 overflow-hidden rounded-lg bg-muted outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10";

export function NoteAttachments({
  noteId,
  readOnly = false,
  hideWhenEmpty = false,
}: NoteAttachmentsProps) {
  const query = useQuery(noteAttachmentsQueryOptions(noteId));
  const upload = useUploadNoteAttachmentMutation(noteId);
  const detach = useDetachNoteAttachmentMutation(noteId);
  const [uploading, setUploading] = useState<UploadingFile[]>([]);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState<AttachmentOutput | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const helpId = useId();
  const attachments = query.data ?? [];
  const previewIndex = attachments.findIndex((attachment) => attachment.id === previewId);
  const hasContent = attachments.length > 0 || uploading.length > 0;
  useClipboardFiles((files) => addFiles(files), !readOnly);

  if (hideWhenEmpty && readOnly && query.isSuccess && !attachments.length) return null;

  function addFiles(files: File[]) {
    const knownFiles = new Set(uploading.map((item) => fileIdentity(item.file)));
    for (const file of files) {
      const validationError = validateAttachmentFile(file);
      if (validationError) {
        toast.error(validationError, { description: file.name });
        continue;
      }
      if (knownFiles.has(fileIdentity(file))) continue;
      knownFiles.add(fileIdentity(file));
      void send(file);
    }
  }

  async function send(file: File) {
    const key = crypto.randomUUID();
    setUploading((current) => [...current, { key, file }]);
    try {
      await upload.mutateAsync(file);
      toast.success("Anexo adicionado", { description: file.name });
    } catch {
      toast.error("Não foi possível enviar o anexo.", { description: file.name });
    } finally {
      setUploading((current) => current.filter((item) => item.key !== key));
    }
  }

  async function remove() {
    if (!removingAttachment) return;
    try {
      await detach.mutateAsync(removingAttachment.id);
      if (previewId === removingAttachment.id) setPreviewId(null);
      setRemovingAttachment(null);
      toast.success("Anexo removido da anotação");
    } catch {
      toast.error("Não foi possível remover o anexo.");
    }
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (readOnly) return;
    addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <section aria-labelledby={headingId} className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-sm" id={headingId}>
          Anexos
        </h3>
        {attachments.length ? (
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatAttachmentCount(attachments.length)}
          </span>
        ) : null}
      </div>

      {query.isLoading ? (
        <div
          aria-label="Carregando anexos"
          className="grid grid-cols-3 gap-2 sm:grid-cols-4"
          role="status"
        >
          <Skeleton className="aspect-square rounded-lg" />
          <Skeleton className="aspect-square rounded-lg" />
          <span className="sr-only">Carregando…</span>
        </div>
      ) : null}

      {query.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <p className="text-muted-foreground text-xs">Não foi possível carregar os anexos.</p>
          <Button onClick={() => void query.refetch()} size="sm" type="button" variant="ghost">
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {query.isSuccess && !hasContent && readOnly ? (
        <p className="rounded-lg border border-dashed p-3 text-muted-foreground text-xs">
          Nenhum arquivo anexado.
        </p>
      ) : null}

      {query.isSuccess && (hasContent || !readOnly) ? (
        <ul
          aria-label="Arquivos anexados"
          className={cn(
            "grid min-w-0 gap-2",
            hasContent ? "grid-cols-3 sm:grid-cols-4" : "grid-cols-1",
          )}
        >
          {attachments.map((attachment) => (
            <li className="min-w-0" key={attachment.id}>
              <NoteAttachmentTile
                attachment={attachment}
                onPreview={() => setPreviewId(attachment.id)}
                onRemove={readOnly ? undefined : () => setRemovingAttachment(attachment)}
              />
            </li>
          ))}
          {uploading.map(({ key, file }) => (
            <li className="min-w-0" key={key}>
              <div
                aria-label={`Enviando ${file.name}`}
                className={cn(
                  tileClassName,
                  "grid place-items-center bg-muted/50 p-2 text-center outline-dashed",
                )}
                role="status"
              >
                <span className="grid min-w-0 justify-items-center gap-1.5">
                  <Loader2
                    aria-hidden="true"
                    className="size-5 animate-spin text-muted-foreground"
                  />
                  <span className="w-full truncate text-[11px] text-muted-foreground leading-tight">
                    Enviando…
                  </span>
                </span>
              </div>
            </li>
          ))}
          {!readOnly ? (
            <li className={cn("min-w-0", !hasContent && "col-span-full")}>
              <button
                aria-describedby={helpId}
                aria-label="Adicionar anexo"
                className={cn(
                  "flex w-full items-center rounded-lg border border-input border-dashed text-muted-foreground outline-none transition-[color,background-color,border-color,scale] hover:border-brand-strong/50 hover:bg-brand/5 hover:text-brand-strong focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]",
                  hasContent
                    ? "aspect-square flex-col justify-center gap-1.5 p-2"
                    : "min-h-16 gap-3 px-3 py-3 text-left",
                )}
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDrop={handleDrop}
                type="button"
              >
                <span
                  className={cn(
                    "grid shrink-0 place-items-center rounded-md bg-brand/10 text-brand-strong",
                    hasContent ? "size-8" : "size-10",
                  )}
                >
                  {hasContent ? (
                    <Plus aria-hidden="true" className="size-4" />
                  ) : (
                    <Paperclip aria-hidden="true" className="size-4" />
                  )}
                </span>
                {hasContent ? (
                  <span className="font-medium text-xs">Adicionar</span>
                ) : (
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-medium text-foreground text-sm">Anexar arquivo</span>
                    <span className="text-muted-foreground text-xs">
                      Escolha, arraste ou cole (Ctrl+V) uma imagem ou PDF.
                    </span>
                  </span>
                )}
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}

      {!readOnly ? (
        <>
          <input
            accept={attachmentAccept}
            className="sr-only"
            multiple
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
            ref={inputRef}
            tabIndex={-1}
            type="file"
          />
          <p className="text-muted-foreground text-xs text-pretty" id={helpId}>
            Cole com Ctrl+V ou arraste até aqui · PDF, JPEG, PNG ou WebP · máx.{" "}
            {maximumAttachmentSizeMb} MB. Os anexos são salvos na hora.
          </p>
        </>
      ) : null}

      {previewIndex >= 0 ? (
        <AttachmentPreviewDialog
          attachments={attachments}
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
          if (!open && !detach.isPending) setRemovingAttachment(null);
        }}
        open={Boolean(removingAttachment)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-destructive/10 text-destructive">
              <Trash2 aria-hidden="true" />
            </AlertDialogMedia>
            <AlertDialogTitle>Remover este anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="mb-2 block break-all font-medium text-foreground">
                {removingAttachment?.fileName}
              </span>
              <span>
                O arquivo deixará de aparecer nesta anotação. Se não estiver vinculado a outro
                registro, ele também será excluído.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={detach.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={detach.isPending}
              onClick={() => void remove()}
              variant="destructive"
            >
              {detach.isPending ? "Removendo…" : "Remover anexo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function NoteAttachmentTile({
  attachment,
  onPreview,
  onRemove,
}: {
  attachment: AttachmentOutput;
  onPreview: () => void;
  onRemove?: () => void;
}) {
  const isImage = attachment.mimeType.startsWith("image/");
  const image = useAttachmentUrl(attachment.id, isImage);

  return (
    <div className={tileClassName} ref={image.containerRef}>
      <button
        aria-label={`Visualizar ${attachment.fileName}, ${attachmentTypeLabel(attachment.mimeType)} de ${formatFileSize(attachment.fileSize)}`}
        className="absolute inset-0 grid place-items-center text-muted-foreground outline-none transition-transform focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset active:scale-[0.96]"
        onClick={onPreview}
        title={attachment.fileName}
        type="button"
      >
        {isImage && image.data?.url ? (
          <AttachmentImage
            alt=""
            className="size-full object-cover transition-transform duration-300 ease-out group-hover/tile:scale-[1.03]"
            height={240}
            objectFit="cover"
            src={image.data.url}
            width={240}
          />
        ) : isImage ? (
          <FileImage
            aria-hidden="true"
            className={cn("size-7 opacity-40", image.isLoading && "animate-pulse")}
          />
        ) : (
          <span className="grid size-full place-items-center bg-destructive/5 text-destructive/70">
            <FileText aria-hidden="true" className="size-7" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-2 pt-5 pb-1.5 text-left">
          <span className="block truncate font-medium text-[11px] text-white leading-tight">
            {attachment.fileName}
          </span>
        </span>
      </button>
      {onRemove ? (
        <button
          aria-label={`Remover ${attachment.fileName}`}
          className="absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-background/90 text-foreground shadow-sm outline-none transition-[color,background-color,scale] before:absolute before:-inset-2 before:content-[''] hover:bg-destructive hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96]"
          onClick={onRemove}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function fileIdentity(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
