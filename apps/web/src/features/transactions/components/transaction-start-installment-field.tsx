import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";
import {
  getTrackedInstallmentHelper,
  getTransactionFormErrorMessage,
} from "./transaction-form.validation";

export function TransactionStartInstallmentField({
  form,
  isSubmitting,
  isTransfer,
  showStartInstallment,
  installmentCount,
  startInstallment,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  isSubmitting: boolean;
  isTransfer: boolean;
  showStartInstallment: boolean;
  installmentCount: number;
  startInstallment: number;
}) {
  return (
    <>
      {!isTransfer && showStartInstallment ? (
        <div className="grid gap-4">
          <form.Field name="startInstallment">
            {(field) => (
              <FieldShell
                error={getTransactionFormErrorMessage("startInstallment", field.state.meta.errors)}
                label="Primeira parcela a registrar"
              >
                <div className="space-y-1.5">
                  <Select
                    disabled={isSubmitting || !Number.isInteger(installmentCount)}
                    onValueChange={(value) => value && field.handleChange(value)}
                    value={field.state.value}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        {Number.isInteger(startInstallment)
                          ? `${startInstallment}ª parcela`
                          : "Selecione"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        {
                          length:
                            Number.isInteger(installmentCount) && installmentCount > 0
                              ? installmentCount
                              : 0,
                        },
                        (_, index) => index + 1,
                      ).map((installment) => (
                        <SelectItem key={installment} value={String(installment)}>
                          {installment}ª parcela
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {startInstallment > 1 ? (
                    <p className="text-muted-foreground text-xs">
                      {getTrackedInstallmentHelper(installmentCount, startInstallment)}
                    </p>
                  ) : null}
                </div>
              </FieldShell>
            )}
          </form.Field>
        </div>
      ) : null}
    </>
  );
}
