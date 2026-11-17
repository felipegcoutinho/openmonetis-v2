import { FormActions } from "@/components/forms/form-actions";

import { transactionTypeLabels } from "../transactions.presentation";
import type { TransactionFormProps } from "./transaction-form.types";
import type { TransactionFormValues } from "./transaction-form.validation";

export function TransactionFormActions({
  transaction,
  attachmentBusy,
  onCancel,
  submitLabel,
  mode,
  values,
  isDirty,
  isSubmitting,
}: {
  transaction: TransactionFormProps["transaction"];
  attachmentBusy: boolean;
  onCancel: TransactionFormProps["onCancel"];
  submitLabel: TransactionFormProps["submitLabel"];
  mode: "create" | "edit" | "copy";
  values: TransactionFormValues;
  isDirty: boolean;
  isSubmitting: boolean;
}) {
  return (
    <FormActions
      busy={isSubmitting || attachmentBusy}
      onCancel={onCancel}
      submitDisabled={mode === "edit" && !isDirty}
      submitLabel={
        mode === "edit"
          ? transaction?.isRecurring
            ? "Revisar alcance"
            : "Atualizar"
          : (submitLabel ??
            `Salvar ${transactionTypeLabels[values.type].toLocaleLowerCase("pt-BR")}`)
      }
    />
  );
}
