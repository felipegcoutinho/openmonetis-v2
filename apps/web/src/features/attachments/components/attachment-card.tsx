import type { AttachmentListItemOutput } from "@openmonetis/validators/attachments";
import { Link } from "@tanstack/react-router";
import { Eye, FileImage, FileText, MoreVertical, ReceiptText, Trash2 } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import {
  attachmentTypeLabel,
  formatAttachmentDate,
  formatFileSize,
} from "../attachments.presentation";
import { useAttachmentUrl } from "../useAttachmentUrl";
import { AttachmentImage } from "./attachment-image";

type AttachmentCardProps = {
  attachment: AttachmentListItemOutput;
  onPreview: () => void;
  onRemove: () => void;
};

export function AttachmentCard({ attachment, onPreview, onRemove }: AttachmentCardProps) {
  const isImage = attachment.mimeType.startsWith("image/");
  const imageQuery = useAttachmentUrl(attachment.id, isImage);

  return (
    <Card
      className="group gap-0 border py-0 transition-colors hover:border-brand-strong/40"
      ref={imageQuery.containerRef}
    >
      <button
        aria-label={`Visualizar ${attachment.fileName}`}
        className="relative grid aspect-4/3 w-full place-items-center overflow-hidden border-b bg-muted/60 text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        onClick={onPreview}
        type="button"
      >
        {isImage && imageQuery.data?.url ? (
          <AttachmentImage
            alt={attachment.fileName}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            height={480}
            objectFit="cover"
            src={imageQuery.data.url}
            width={640}
          />
        ) : null}
        {isImage && !imageQuery.data?.url ? (
          <div
            className={cn(
              "grid h-full w-full place-items-center",
              imageQuery.isLoading && "animate-pulse",
            )}
          >
            <FileImage aria-hidden="true" className="size-12 opacity-35" />
          </div>
        ) : null}
        {!isImage ? (
          <div className="grid h-full w-full place-items-center bg-destructive/5 text-destructive/70">
            <FileText aria-hidden="true" className="size-14" />
          </div>
        ) : null}
        <Badge className="absolute top-3 left-3" variant="secondary">
          {attachmentTypeLabel(attachment.mimeType)}
        </Badge>
        <span className="absolute inset-0 grid place-items-center bg-foreground/0 opacity-0 transition-all group-hover:bg-foreground/10 group-hover:opacity-100">
          <span className="grid size-9 place-items-center rounded-full bg-background/90 text-foreground shadow-sm">
            <Eye aria-hidden="true" className="size-4" />
          </span>
        </span>
      </button>

      <div className="grid flex-1 gap-3 p-4">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-medium" title={attachment.fileName}>
              {attachment.fileName}
            </h3>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {formatFileSize(attachment.fileSize)}
              {attachment.linkedTransactionCount > 1
                ? ` · ${attachment.linkedTransactionCount} lançamentos`
                : ""}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Ações de ${attachment.fileName}`}
              render={<Button size="icon-sm" type="button" variant="ghost" />}
            >
              <MoreVertical aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onPreview}>
                <Eye aria-hidden="true" />
                Visualizar
              </DropdownMenuItem>
              <DropdownMenuItem
                render={
                  <Link
                    search={{ period: attachment.transactionPeriod, q: attachment.transactionName }}
                    to="/transactions"
                  />
                }
              >
                <ReceiptText aria-hidden="true" />
                Buscar nos lançamentos
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} variant="destructive">
                <Trash2 aria-hidden="true" />
                Excluir anexo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-0 items-center gap-2 rounded-lg bg-muted/50 p-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-background text-muted-foreground shadow-xs">
            <CategoryIcon className="size-4" name={attachment.categoryIcon} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm" title={attachment.transactionName}>
              {attachment.transactionName}
            </p>
            <p className="truncate text-muted-foreground text-xs">
              {attachment.personName}
              {attachment.categoryName ? ` · ${attachment.categoryName}` : ""}
            </p>
          </div>
          <MoneyValue
            amount={attachment.transactionAmount}
            className={cn(
              "shrink-0 text-sm",
              attachment.transactionType === "income" && "text-success",
            )}
            showPositiveSign={attachment.transactionType === "income"}
          />
        </div>

        <p className="text-muted-foreground text-xs">
          Data do lançamento: {formatAttachmentDate(attachment.purchaseDate)}
        </p>
      </div>
    </Card>
  );
}
