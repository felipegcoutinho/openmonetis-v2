import type { AttachmentOutput } from "@openmonetis/validators/attachments";
import { useQuery } from "@tanstack/react-query";
import { FileImage, FileText, RefreshCw, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
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
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger,
} from "@/components/ui/attachment";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useDetachAttachmentMutation, useUploadAttachmentMutation } from "../attachments.mutations";
import { formatFileSize } from "../attachments.presentation";
import { transactionAttachmentsQueryOptions } from "../attachments.queries";
import { AttachmentFilePicker } from "./attachment-file-picker";
import { AttachmentPreviewDialog } from "./attachment-preview-dialog";

type TransactionAttachmentsProps = {
  transactionId: string;
  onBusyChange?: (busy: boolean) => void;
  readOnly?: boolean;
};

export function TransactionAttachments({
  transactionId,
  onBusyChange,
  readOnly = false,
}: TransactionAttachmentsProps) {
  const query = useQuery(transactionAttachmentsQueryOptions(transactionId));
  const upload = useUploadAttachmentMutation(transactionId);
  const detach = useDetachAttachmentMutation(transactionId);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [removingAttachment, setRemovingAttachment] = useState<AttachmentOutput | null>(null);
  const activeOperations = useRef(0);
  const previewIndex = query.data?.findIndex((attachment) => attachment.id === previewId) ?? -1;

  async function select(file: File) {
    beginOperation();
    try {
      await upload.mutateAsync(file);
      toast.success("Anexo enviado");
    } catch {
      toast.error("Não foi possível enviar o anexo.", { description: file.name });
    } finally {
      endOperation();
    }
  }

  async function remove() {
    if (!removingAttachment) return;

    beginOperation();
    try {
      await detach.mutateAsync(removingAttachment.id);
      if (previewId === removingAttachment.id) setPreviewId(null);
      setRemovingAttachment(null);
      toast.success("Anexo removido do lançamento");
    } catch {
      toast.error("Não foi possível remover o anexo.");
    } finally {
      endOperation();
    }
  }

  function beginOperation() {
    activeOperations.current += 1;
    if (activeOperations.current === 1) onBusyChange?.(true);
  }

  function endOperation() {
    activeOperations.current = Math.max(0, activeOperations.current - 1);
    if (activeOperations.current === 0) onBusyChange?.(false);
  }

  return (
    <div className="grid gap-2">
      {query.isLoading ? (
        <div aria-label="Carregando anexos" className="grid gap-2" role="status">
          <Skeleton className="h-11 w-full" />
          <span className="sr-only">Carregando...</span>
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

      {query.data?.length ? (
        <AttachmentGroup
          aria-label="Anexos do lançamento"
          className="grid gap-2 overflow-hidden py-0 *:data-[slot=attachment]:w-full"
          role="group"
        >
          {query.data.map((attachment) => (
            <Attachment
              className="w-full overflow-hidden bg-muted/30 shadow-none"
              key={attachment.id}
              size="sm"
            >
              <AttachmentMedia>
                {attachment.mimeType.startsWith("image/") ? <FileImage /> : <FileText />}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{attachment.fileName}</AttachmentTitle>
                <AttachmentDescription>{formatFileSize(attachment.fileSize)}</AttachmentDescription>
              </AttachmentContent>
              {!readOnly ? (
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remover ${attachment.fileName}`}
                    disabled={detach.isPending}
                    onClick={() => setRemovingAttachment(attachment)}
                    type="button"
                  >
                    <Trash2 className="text-destructive" />
                  </AttachmentAction>
                </AttachmentActions>
              ) : null}
              <AttachmentTrigger
                aria-label={`Visualizar ${attachment.fileName}`}
                onClick={() => setPreviewId(attachment.id)}
              />
            </Attachment>
          ))}
        </AttachmentGroup>
      ) : null}

      {!query.isLoading && !query.isError && !query.data?.length ? (
        <p className="text-muted-foreground text-xs">Nenhum anexo neste lançamento.</p>
      ) : null}

      {!readOnly ? (
        <>
          <AttachmentFilePicker disabled={upload.isPending} onAdd={(file) => void select(file)} />
          <p className="text-muted-foreground text-xs">
            Envios e remoções de anexos são salvos imediatamente.
          </p>
        </>
      ) : null}

      {query.data && previewIndex >= 0 ? (
        <AttachmentPreviewDialog
          attachments={query.data}
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
                O arquivo deixará de aparecer neste lançamento. Se não estiver vinculado a outro,
                ele também será excluído.
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
              {detach.isPending ? "Removendo..." : "Remover anexo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
