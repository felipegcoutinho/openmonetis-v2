import type { CreateNoteInput, NoteOutput, ReplaceNoteInput } from "@openmonetis/validators/notes";
import { useRef, useState } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
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
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NoteForm, type NoteFormHandle } from "./note-form";

type NoteDialogProps = {
  note: NoteOutput | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateNoteInput | ReplaceNoteInput) => Promise<void>;
  open: boolean;
  pending: boolean;
};

export function NoteDialog({ note, onOpenChange, onSubmit, open, pending }: NoteDialogProps) {
  const formRef = useRef<NoteFormHandle>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  function requestOpenChange(nextOpen: boolean) {
    if (!nextOpen && pending) return;
    if (!nextOpen && formRef.current?.hasUnsavedChanges()) {
      setDiscardOpen(true);
      return;
    }
    onOpenChange(nextOpen);
  }

  return (
    <>
      <Dialog onOpenChange={requestOpenChange} open={open}>
        <DialogContent
          className="flex flex-col overflow-hidden sm:max-w-xl"
          showCloseButton={!pending}
        >
          <DialogHeader className="shrink-0">
            <DialogTitle>{note ? "Editar anotação" : "Nova anotação"}</DialogTitle>
            <DialogDescription>
              {note
                ? "Atualize o conteúdo e os itens já registrados."
                : "Crie uma nota, uma lista ou uma tarefa com data para acompanhar."}
            </DialogDescription>
          </DialogHeader>
          <NoteForm
            key={note?.id ?? "new-note"}
            note={note}
            onCancel={() => requestOpenChange(false)}
            onSubmit={onSubmit}
            ref={formRef}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setDiscardOpen} open={discardOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              O conteúdo ainda não salvo será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setDiscardOpen(false);
                onOpenChange(false);
              }}
              variant="destructive"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
