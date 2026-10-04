import { toast } from "sonner";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  recurrenceFrequencyLabels,
  transactionConditionLabels,
} from "../transactions.presentation";
import type { useTransactionForm } from "../useTransactionForm";
import { TransactionConditionOption } from "./transaction-condition-option";
import { FieldShell } from "./transaction-field-shell";
import type { TransactionFormProps } from "./transaction-form.types";
import {
  getTransactionFormErrorMessage,
  type TransactionFormValues,
} from "./transaction-form.validation";

export function TransactionScheduleFields({
  pendingFiles,
  setPendingFiles,
  form,
  transaction,
  allowedConditions,
  values,
  isSubmitting,
  isTransfer,
  isSeriesEdit,
  getInstallmentLabel,
}: {
  pendingFiles: ReturnType<typeof useTransactionForm>["pendingFiles"];
  setPendingFiles: ReturnType<typeof useTransactionForm>["setPendingFiles"];
  form: ReturnType<typeof useTransactionForm>["form"];
  transaction: TransactionFormProps["transaction"];
  allowedConditions: TransactionFormProps["allowedConditions"];
  values: TransactionFormValues;
  isSubmitting: boolean;
  isTransfer: boolean;
  isSeriesEdit: boolean;
  getInstallmentLabel: (count: number) => string;
}) {
  return (
    <>
      {!isSeriesEdit && !isTransfer ? (
        <div
          className={cn(
            "grid gap-4",
            (values.condition === "installment" || values.condition === "recurring") &&
              "sm:grid-cols-2",
          )}
        >
          <form.Field name="condition">
            {(field) => (
              <FieldShell
                error={getTransactionFormErrorMessage("condition", field.state.meta.errors)}
                label="Repetição ou parcelamento"
              >
                <Select
                  disabled={isSubmitting || isTransfer}
                  onValueChange={(value) => {
                    const condition = value as TransactionFormValues["condition"];
                    field.handleChange(condition);
                    if (condition === "recurring" && pendingFiles.length) {
                      setPendingFiles([]);
                      toast.info("Os anexos selecionados foram removidos", {
                        description:
                          "Anexos ficam disponíveis quando a recorrência gerar um lançamento.",
                      });
                    }
                  }}
                  value={field.state.value}
                >
                  <SelectTrigger
                    className="w-full"
                    aria-invalid={field.state.meta.errors.length > 0}
                  >
                    <SelectValue placeholder="Selecione">
                      <TransactionConditionOption condition={field.state.value} />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(transactionConditionLabels)
                      .filter(
                        ([value]) =>
                          (!transaction?.isRecurring || value === "recurring") &&
                          (!allowedConditions ||
                            allowedConditions.includes(
                              value as TransactionFormValues["condition"],
                            )),
                      )
                      .map(([value]) => (
                        <SelectItem key={value} value={value}>
                          <TransactionConditionOption
                            condition={value as TransactionFormValues["condition"]}
                          />
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </FieldShell>
            )}
          </form.Field>

          {values.condition === "installment" ? (
            <form.Field name="installmentCount">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage(
                    "installmentCount",
                    field.state.meta.errors,
                  )}
                  label="Parcelado em"
                >
                  <Select
                    disabled={isSubmitting}
                    onValueChange={(value) => {
                      if (!value) return;
                      field.handleChange(value);
                      if (Number(form.getFieldValue("startInstallment")) > Number(value)) {
                        form.setFieldValue("startInstallment", value);
                      }
                    }}
                    value={field.state.value}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        {getInstallmentLabel(Number(field.state.value))}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent
                      align="end"
                      className="w-max min-w-(--anchor-width) max-w-[calc(100vw-2rem)]"
                    >
                      {Array.from({ length: 59 }, (_, index) => index + 2).map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {getInstallmentLabel(count)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}
            </form.Field>
          ) : null}

          {values.condition === "recurring" ? (
            <form.Field name="recurrenceFrequency">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage(
                    "recurrenceFrequency",
                    field.state.meta.errors,
                  )}
                  label="Frequência"
                >
                  <Select
                    disabled={isSubmitting}
                    onValueChange={(value) =>
                      field.handleChange(value as TransactionFormValues["recurrenceFrequency"])
                    }
                    value={field.state.value}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        {recurrenceFrequencyLabels[field.state.value]}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(recurrenceFrequencyLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}
            </form.Field>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
