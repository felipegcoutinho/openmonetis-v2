import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type FormActionsProps = {
  /** "Salvar <item>" when creating, "Atualizar" when editing. Stays the same while busy. */
  submitLabel: string;
  onCancel: () => void;
  /** Saving or preparing the submission: shows a spinner and locks both buttons. */
  busy: boolean;
  /** Blocks the submit for a reason other than being busy (e.g. a missing prerequisite). */
  submitDisabled?: boolean;
  /** Announces the submit as unavailable while keeping it clickable to reveal validation. */
  submitAriaDisabled?: boolean;
  className?: string;
};

/**
 * Footer shared by every create/edit form: "Cancelar" and the primary action side by side in
 * equal columns, the primary one with a save icon that turns into a spinner while busy. The label
 * does not change while saving, so the button keeps its width; `aria-busy` announces the wait.
 * On mobile forms the footer becomes the sticky action bar (see `mobile-forms.css`).
 */
export function FormActions({
  submitLabel,
  onCancel,
  busy,
  submitDisabled = false,
  submitAriaDisabled,
  className,
}: FormActionsProps) {
  return (
    <DialogFooter className={cn("pt-2", className)} data-mobile-form-actions>
      <Button data-mobile-cancel disabled={busy} onClick={onCancel} type="button" variant="outline">
        Cancelar
      </Button>
      <Button
        aria-busy={busy || undefined}
        aria-disabled={submitAriaDisabled || undefined}
        className="h-auto min-h-9 min-w-0 whitespace-normal text-center"
        disabled={busy || submitDisabled}
        type="submit"
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Save aria-hidden="true" />
        )}
        {submitLabel}
      </Button>
    </DialogFooter>
  );
}
