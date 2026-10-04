import { useForm } from "@tanstack/react-form";
import { useId } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { showInvalidFormToast } from "@/lib/form-feedback";

const MAX_PASSKEY_NAME_LENGTH = 120;

export function PasskeyNameDialog({
  initialName = "",
  mode,
  onOpenChange,
  onSubmit,
  open,
}: {
  initialName?: string;
  mode: "add" | "rename";
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string) => Promise<void>;
  open: boolean;
}) {
  const inputId = useId();
  const form = useForm({
    defaultValues: { name: initialName },
    onSubmitInvalid: showInvalidFormToast,
    onSubmit: async ({ value }) => {
      const name = value.name.trim();
      if (mode === "rename" && !name) return;
      await onSubmit(name);
    },
  });

  const isAdding = mode === "add";

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded mobileLayout="sheet">
        <DialogHeader>
          <DialogTitle>
            {isAdding ? "Cadastrar chave de acesso" : "Renomear chave de acesso"}
          </DialogTitle>
          <DialogDescription>
            {isAdding
              ? "Dê um nome à chave. Em seguida, confirme no navegador com biometria, PIN ou chave de segurança."
              : "Use um nome que ajude a identificar onde esta chave está disponível."}
          </DialogDescription>
        </DialogHeader>

        <form
          data-mobile-page-form
          className="grid gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              isDirty: !state.isDefaultValue,
              isSubmitting: state.isSubmitting,
            })}
          >
            {(state) => <MobileFormState {...state} />}
          </form.Subscribe>
          <form.Field
            name="name"
            validators={{
              onBlur: ({ value }) => {
                const name = value.trim();
                if (mode === "rename" && !name) return "Informe um nome.";
                if (name.length > MAX_PASSKEY_NAME_LENGTH) return "Use até 120 caracteres.";
                return undefined;
              },
              onSubmit: ({ value }) => {
                const name = value.trim();
                if (mode === "rename" && !name) return "Informe um nome.";
                if (name.length > MAX_PASSKEY_NAME_LENGTH) return "Use até 120 caracteres.";
                return undefined;
              },
            }}
          >
            {(field) => (
              <div className="grid gap-2">
                <Label htmlFor={inputId}>Nome {isAdding ? "(opcional)" : ""}</Label>
                <Input
                  aria-invalid={field.state.meta.errors.length > 0}
                  aria-describedby={field.state.meta.errors.length ? `${inputId}-error` : undefined}
                  autoComplete="off"
                  autoFocus
                  id={inputId}
                  maxLength={MAX_PASSKEY_NAME_LENGTH}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  placeholder="Ex.: MacBook pessoal"
                  value={field.state.value}
                />
                <p className="text-destructive text-sm" id={`${inputId}-error`} role="alert">
                  {field.state.meta.errors[0] ?? ""}
                </p>
              </div>
            )}
          </form.Field>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <DialogFooter>
                <Button
                  data-mobile-cancel
                  disabled={isSubmitting}
                  onClick={() => onOpenChange(false)}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button disabled={isSubmitting} type="submit">
                  {isSubmitting
                    ? isAdding
                      ? "Confirmando..."
                      : "Salvando..."
                    : isAdding
                      ? "Continuar"
                      : "Salvar"}
                </Button>
              </DialogFooter>
            )}
          </form.Subscribe>
        </form>
      </DialogContent>
    </Dialog>
  );
}
