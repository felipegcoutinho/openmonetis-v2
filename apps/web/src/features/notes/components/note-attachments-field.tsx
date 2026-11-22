import type { Dispatch, SetStateAction } from "react";
import { AttachmentFilePicker } from "@/features/attachments/components/attachment-file-picker";
import { NoteAttachments } from "./note-attachments";

type NoteAttachmentsFieldProps = {
  disabled: boolean;
  noteId?: string;
  pendingFiles: File[];
  setPendingFiles: Dispatch<SetStateAction<File[]>>;
};

/** New notes queue files until the note exists; saved notes manage attachments directly. */
export function NoteAttachmentsField({
  disabled,
  noteId,
  pendingFiles,
  setPendingFiles,
}: NoteAttachmentsFieldProps) {
  if (noteId) return <NoteAttachments noteId={noteId} />;

  return (
    <section aria-label="Anexos" className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-medium text-sm">Anexos</h3>
        <span className="text-muted-foreground text-xs">Opcional</span>
      </div>
      <AttachmentFilePicker
        captureDocumentPaste
        disabled={disabled}
        files={pendingFiles}
        onAdd={(file) => setPendingFiles((current) => [...current, file])}
        onRemove={(file) => setPendingFiles((current) => current.filter((item) => item !== file))}
      />
    </section>
  );
}
