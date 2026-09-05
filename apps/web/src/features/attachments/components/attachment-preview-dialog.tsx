import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAttachmentUrl } from "../attachments.api";
import { attachmentUrlQueryOptions } from "../attachments.queries";
import { AttachmentImage } from "./attachment-image";

type AttachmentPreviewItem = {
  id: string;
  fileName: string;
  mimeType: string;
  transactionName?: string;
};

type AttachmentPreviewDialogProps = {
  attachments: AttachmentPreviewItem[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AttachmentPreviewDialog({
  attachments,
  initialIndex,
  open,
  onOpenChange,
}: AttachmentPreviewDialogProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isDownloading, setIsDownloading] = useState(false);
  const attachment = attachments[currentIndex];
  const urlQuery = useQuery(attachmentUrlQueryOptions(attachment?.id ?? "", open));
  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < attachments.length - 1;

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowLeft" && hasPrevious) setCurrentIndex((index) => index - 1);
      if (event.key === "ArrowRight" && hasNext) setCurrentIndex((index) => index + 1);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrevious, open]);

  if (!attachment) return null;

  const previewUrl = urlQuery.data?.url;
  const isImage = attachment.mimeType.startsWith("image/");
  const isPdf = attachment.mimeType === "application/pdf";

  async function download() {
    setIsDownloading(true);

    try {
      const result = await getAttachmentUrl(attachment.id, "attachment");
      const link = document.createElement("a");
      link.href = result.url;
      link.rel = "noreferrer";
      link.click();
    } catch {
      toast.error("Não foi possível baixar o anexo.");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="h-[min(92svh,56rem)] max-w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b py-3 pr-14 pl-4 sm:pr-14 sm:pl-5">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="truncate" title={attachment.fileName}>
                {attachment.fileName}
              </DialogTitle>
              <DialogDescription className="truncate">
                {attachment.transactionName ?? "Visualização do anexo"}
              </DialogDescription>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {attachments.length > 1 ? (
                <>
                  <Button
                    aria-label="Anexo anterior"
                    disabled={!hasPrevious}
                    onClick={() => setCurrentIndex((index) => index - 1)}
                    size="icon-sm"
                    title="Anterior (←)"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowLeft aria-hidden="true" />
                  </Button>
                  <span className="min-w-10 text-center text-muted-foreground text-xs tabular-nums">
                    {currentIndex + 1} / {attachments.length}
                  </span>
                  <Button
                    aria-label="Próximo anexo"
                    disabled={!hasNext}
                    onClick={() => setCurrentIndex((index) => index + 1)}
                    size="icon-sm"
                    title="Próximo (→)"
                    type="button"
                    variant="ghost"
                  >
                    <ArrowRight aria-hidden="true" />
                  </Button>
                </>
              ) : null}
              <Button
                aria-label="Baixar anexo"
                disabled={isDownloading}
                onClick={() => void download()}
                size="icon-sm"
                title="Baixar"
                type="button"
                variant="ghost"
              >
                {isDownloading ? (
                  <Loader2 aria-hidden="true" className="animate-spin" />
                ) : (
                  <Download aria-hidden="true" />
                )}
              </Button>
              {previewUrl ? (
                <Button asChild size="icon-sm" title="Abrir em nova aba" variant="ghost">
                  <a
                    aria-label="Abrir anexo em nova aba"
                    href={previewUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <ExternalLink aria-hidden="true" />
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 bg-muted/30">
          {urlQuery.isLoading ? (
            <div className="grid h-full place-items-center" role="status">
              <div className="text-center text-muted-foreground text-sm">
                <Loader2 aria-hidden="true" className="mx-auto mb-2 size-5 animate-spin" />
                Carregando anexo...
              </div>
            </div>
          ) : null}

          {urlQuery.isError ? (
            <div className="grid h-full place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível abrir o anexo</p>
                <p className="mt-1 text-muted-foreground text-sm">Tente novamente em instantes.</p>
                <Button
                  className="mt-4"
                  onClick={() => void urlQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" />
                  Tentar novamente
                </Button>
              </div>
            </div>
          ) : null}

          {previewUrl && isImage ? (
            <div className="flex h-full items-center justify-center bg-foreground/95 p-3 sm:p-6">
              <AttachmentImage
                alt={attachment.fileName}
                className="max-h-full max-w-full rounded-md object-contain"
                height={1200}
                objectFit="contain"
                src={previewUrl}
                width={1600}
              />
            </div>
          ) : null}

          {previewUrl && isPdf ? (
            <iframe
              className="h-full w-full border-0 bg-background"
              src={previewUrl}
              title={attachment.fileName}
            />
          ) : null}

          {previewUrl && !isImage && !isPdf ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <FileText aria-hidden="true" className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-3 text-muted-foreground text-sm">Pré-visualização indisponível.</p>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
