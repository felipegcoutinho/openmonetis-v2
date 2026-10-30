import {
  maximumInstallmentCount,
  minimumInstallmentCount,
} from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MobileDatePicker } from "@/components/forms/mobile-date-picker";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  formatInstallmentOption,
  recurrenceFrequencyLabels,
  transactionConditionLabels,
} from "../transactions.presentation";
import { installmentOptionsQueryOptions } from "../transactions.queries";
import type { useTransactionForm } from "../useTransactionForm";
import { RecurrenceOccurrenceCountPicker } from "./recurrence-occurrence-count-picker";
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
}) {
  const preview = useQuery(
    installmentOptionsQueryOptions(values.amount, values.condition === "installment"),
  );
  const [appliedOccurrenceCount, setAppliedOccurrenceCount] = useState<{
    endDate: string;
    frequency: TransactionFormValues["recurrenceFrequency"];
    occurrenceCount: number;
    startDate: string;
  } | null>(null);
  const recurrenceEndDateQuery = {
    startDate: values.purchaseDate,
    anchorDate: values.recurrenceAnchorDate || undefined,
    dueDate: values.paymentMethod !== "credit_card" && values.dueDate ? values.dueDate : undefined,
    frequency: values.recurrenceFrequency,
  };
  const getInstallmentLabel = (count: number) =>
    formatInstallmentOption(
      count,
      preview.data?.options.find((option) => option.count === count),
    );
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
                      {Array.from(
                        { length: maximumInstallmentCount - minimumInstallmentCount + 1 },
                        (_, index) => index + minimumInstallmentCount,
                      ).map((count) => (
                        <SelectItem key={count} value={String(count)}>
                          {getInstallmentLabel(count)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {preview.isError ? (
                    <p className="text-muted-foreground text-xs" role="status">
                      Prévia de valores indisponível. Você pode escolher a quantidade de parcelas.
                    </p>
                  ) : null}
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
                    onValueChange={(value) => {
                      field.handleChange(value as TransactionFormValues["recurrenceFrequency"]);
                    }}
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
      {values.condition === "recurring" && !isTransfer ? (
        <form.Field name="recurrenceEndDate">
          {(field) => (
            <FieldShell
              label="Repetir até (opcional)"
              error={getTransactionFormErrorMessage("recurrenceEndDate", field.state.meta.errors)}
            >
              <div className="flex items-center gap-1">
                <div className="min-w-0 flex-1">
                  <MobileDatePicker
                    value={field.state.value}
                    onChange={field.handleChange}
                    min={values.purchaseDate}
                    placeholder="Sem data final"
                    disabled={isSubmitting}
                    aria-invalid={field.state.meta.errors.length > 0}
                  />
                </div>
                {field.state.value ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground max-md:size-12"
                          aria-label="Remover data final"
                          disabled={isSubmitting}
                          onClick={() => field.handleChange("")}
                        />
                      }
                    >
                      <X className="size-4" aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>Remover data final</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <div className="flex items-start justify-between gap-2">
                <p className="text-muted-foreground text-xs">
                  {field.state.value
                    ? appliedOccurrenceCount?.endDate === field.state.value &&
                      appliedOccurrenceCount.startDate === values.purchaseDate &&
                      appliedOccurrenceCount.frequency === values.recurrenceFrequency
                      ? `${appliedOccurrenceCount.occurrenceCount} ocorrências; inclui a data selecionada.`
                      : "Inclui a data selecionada."
                    : "Sem data final, a recorrência continua sem prazo."}
                </p>
                {values.purchaseDate ? (
                  <RecurrenceOccurrenceCountPicker
                    disabled={isSubmitting}
                    query={recurrenceEndDateQuery}
                    onApply={({ endDate, occurrenceCount }) => {
                      field.handleChange(endDate);
                      setAppliedOccurrenceCount({
                        endDate,
                        frequency: values.recurrenceFrequency,
                        occurrenceCount,
                        startDate: values.purchaseDate,
                      });
                    }}
                  />
                ) : null}
              </div>
            </FieldShell>
          )}
        </form.Field>
      ) : null}
    </>
  );
}
