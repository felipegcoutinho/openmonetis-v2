import { FileImage, FileText, Paperclip, X } from "lucide-react";
import { type ClipboardEvent, type DragEvent, useId, useRef } from "react";
import { toast } from "sonner";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentTitle,
} from "@/components/ui/attachment";
import { cn } from "@/lib/utils";
import {
  attachmentAccept,
  formatFileSize,
  getFilesFromClipboard,
  maximumAttachmentSizeMb,
  validateAttachmentFile,
} from "../attachments.presentation";

type AttachmentFilePickerProps = {
  files?: File[];
  disabled?: boolean;
  onAdd: (file: File) => void;
  onRemove?: (file: File) => void;
};

export function AttachmentFilePicker({
  files = [],
  disabled = false,
  onAdd,
  onRemove,
}: AttachmentFilePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const descriptionId = useId();

  function addFiles(filesToAdd: File[]) {
    const knownFiles = new Set(files.map(fileIdentity));
    let foundDuplicate = false;

    for (const file of filesToAdd) {
      const validationError = validateAttachmentFile(file);

      if (validationError) {
        toast.error(validationError, { description: file.name });
        continue;
      }

      const identity = fileIdentity(file);
      if (knownFiles.has(identity)) {
        foundDuplicate = true;
        continue;
      }

      knownFiles.add(identity);
      onAdd(file);
    }

    if (foundDuplicate) toast.info("O arquivo já está na lista.");
  }

  function handlePaste(event: ClipboardEvent<HTMLButtonElement>) {
    const pastedFiles = getFilesFromClipboard(event);
    if (!pastedFiles.length || disabled) return;

    event.preventDefault();
    addFiles(pastedFiles);
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (disabled) return;

    addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="min-w-0 overflow-hidden rounded-md border border-input bg-muted/20">
      {files.length ? (
        <AttachmentGroup
          aria-label="Arquivos selecionados"
          className="grid gap-0 divide-y divide-border overflow-hidden py-0 *:data-[slot=attachment]:w-full"
          role="group"
        >
          {files.map((file) => (
            <Attachment
              className="w-full overflow-hidden rounded-none border-0 bg-transparent shadow-none"
              key={fileIdentity(file)}
              size="sm"
              state="done"
            >
              <AttachmentMedia>
                {file.type.startsWith("image/") ? <FileImage /> : <FileText />}
              </AttachmentMedia>
              <AttachmentContent>
                <AttachmentTitle>{file.name}</AttachmentTitle>
                <AttachmentDescription>
                  Será adicionado ao salvar · {formatFileSize(file.size)}
                </AttachmentDescription>
              </AttachmentContent>
              {onRemove ? (
                <AttachmentActions>
                  <AttachmentAction
                    aria-label={`Remover ${file.name}`}
                    disabled={disabled}
                    onClick={() => onRemove(file)}
                    type="button"
                  >
                    <X />
                  </AttachmentAction>
                </AttachmentActions>
              ) : null}
            </Attachment>
          ))}
        </AttachmentGroup>
      ) : null}

      <input
        accept={attachmentAccept}
        className="sr-only"
        disabled={disabled}
        multiple
        onChange={(event) => {
          addFiles(Array.from(event.target.files ?? []));
          event.target.value = "";
        }}
        ref={inputRef}
        type="file"
      />
      <button
        aria-describedby={descriptionId}
        aria-label="Adicionar anexo"
        className={cn(
          "w-full min-w-0 text-left outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
          files.length > 0 && "border-input border-t",
        )}
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={handleDrop}
        onPaste={handlePaste}
        type="button"
      >
        <Attachment
          className="w-full overflow-hidden rounded-none border-0 bg-transparent shadow-none"
          size="default"
          state="done"
        >
          <AttachmentMedia className="bg-brand/10 text-brand-strong">
            <Paperclip />
          </AttachmentMedia>
          <AttachmentContent>
            <AttachmentTitle>{disabled ? "Enviando anexo..." : "Adicionar anexo"}</AttachmentTitle>
            <AttachmentDescription className="whitespace-normal" id={descriptionId}>
              Solte, cole ou escolha PDF, JPEG, PNG ou WebP · máx. {maximumAttachmentSizeMb} MB
            </AttachmentDescription>
          </AttachmentContent>
        </Attachment>
      </button>
    </div>
  );
}

function fileIdentity(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}
