import { X } from "lucide-react";
import { useId } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";
import { getTransactionFormErrorMessage } from "./transaction-form.validation";

export function TransactionDueDateField({
  form,
  isSubmitting,
  visible,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  isSubmitting: boolean;
  visible: boolean;
}) {
  const id = useId();
  return (
    <>
      {visible ? (
        <div className="grid gap-4">
          <form.Field name="dueDate">
            {(field) => (
              <FieldShell
                error={getTransactionFormErrorMessage("dueDate", field.state.meta.errors)}
                label="Vencimento (opcional)"
              >
                <div className="flex items-center gap-1">
                  <DatePicker
                    id={id}
                    className="w-auto min-w-0 flex-1 shrink"
                    aria-invalid={field.state.meta.errors.length > 0}
                    disabled={isSubmitting}
                    onChange={field.handleChange}
                    value={field.state.value}
                    placeholder="Sem vencimento"
                  />
                  {field.state.value ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground max-md:size-12"
                      aria-label="Remover vencimento"
                      title="Remover vencimento"
                      disabled={isSubmitting}
                      onClick={() => field.handleChange("")}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  ) : null}
                </div>
                <p className="text-muted-foreground text-xs">
                  Informe para acompanhar em Contas a pagar e receber avisos de vencimento.
                </p>
              </FieldShell>
            )}
          </form.Field>
          <form.Subscribe
            selector={(state) => ({
              type: state.values.type,
              paymentMethod: state.values.paymentMethod,
              dueDate: state.values.dueDate,
            })}
          >
            {(values) =>
              values.type === "expense" &&
              values.paymentMethod !== "credit_card" &&
              values.dueDate ? (
                <form.Field name="dueDateRuleExcluded">
                  {(field) => (
                    <Label htmlFor={`${id}-exclude`} className="font-mono text-sm">
                      <Checkbox
                        id={`${id}-exclude`}
                        checked={field.state.value}
                        disabled={isSubmitting}
                        onCheckedChange={(value) => field.handleChange(value === true)}
                      />
                      Manter o vencimento informado, sem aplicar regras
                    </Label>
                  )}
                </form.Field>
              ) : null
            }
          </form.Subscribe>
        </div>
      ) : null}
    </>
  );
}
