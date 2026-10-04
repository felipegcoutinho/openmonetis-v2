import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";

import { DialogFooter } from "@/components/ui/dialog";

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
    <DialogFooter className="grid-cols-1 sm:grid-cols-2">
      <Button
        disabled={isSubmitting || attachmentBusy}
        onClick={onCancel}
        type="button"
        variant="outline"
      >
        Cancelar
      </Button>
      <Button
        className="h-auto min-h-9 min-w-0 whitespace-normal text-center"
        disabled={isSubmitting || attachmentBusy || (mode === "edit" && !isDirty)}
        type="submit"
      >
        {isSubmitting ? (
          <Loader2 aria-hidden="true" className="animate-spin" size={16} />
        ) : (
          <Save aria-hidden="true" size={16} />
        )}
        {mode === "edit"
          ? transaction?.isRecurring
            ? "Revisar alcance"
            : "Atualizar"
          : (submitLabel ??
            `Salvar ${transactionTypeLabels[values.type].toLocaleLowerCase("pt-BR")}`)}
      </Button>
    </DialogFooter>
  );
}
