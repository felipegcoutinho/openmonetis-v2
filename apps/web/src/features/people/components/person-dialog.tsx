import type {
  CreatePersonInput,
  PersonOutput,
  ReplacePersonInput,
} from "@openmonetis/validators/people";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonForm } from "./person-form";
export function PersonDialog({
  person,
  onOpenChange,
  onSubmit,
  open,
}: {
  person: PersonOutput | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreatePersonInput | ReplacePersonInput) => Promise<void>;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{person ? "Atualizar pessoa" : "Nova pessoa"}</DialogTitle>
          <DialogDescription>
            {person
              ? "Atualize os detalhes da pessoa."
              : "Selecione um avatar e informe os detalhes."}
          </DialogDescription>
        </DialogHeader>
        <PersonForm
          key={person?.id ?? "new-person"}
          person={person}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
