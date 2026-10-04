import { ChevronDown } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { useTransactionForm } from "../useTransactionForm";
import { TransactionAttachmentsField } from "./transaction-attachments-field";
import { FieldShell } from "./transaction-field-shell";

import type { TransactionFormProps } from "./transaction-form.types";
import {
  getTransactionFormErrorMessage,
  type TransactionFormValues,
} from "./transaction-form.validation";

export function TransactionAdvancedFields({
  pendingFiles,
  setPendingFiles,
  isAdvancedOpen,
  setIsAdvancedOpen,
  form,
  transaction,
  onAttachmentBusyChange,
  mode,
  values,
  isSubmitting,
}: {
  pendingFiles: ReturnType<typeof useTransactionForm>["pendingFiles"];
  setPendingFiles: ReturnType<typeof useTransactionForm>["setPendingFiles"];
  isAdvancedOpen: ReturnType<typeof useTransactionForm>["isAdvancedOpen"];
  setIsAdvancedOpen: ReturnType<typeof useTransactionForm>["setIsAdvancedOpen"];
  form: ReturnType<typeof useTransactionForm>["form"];
  transaction: TransactionFormProps["transaction"];
  onAttachmentBusyChange: TransactionFormProps["onAttachmentBusyChange"];
  mode: "create" | "edit" | "copy";
  values: TransactionFormValues;
  isSubmitting: boolean;
}) {
  return (
    <details
      className="group"
      onToggle={(event) => setIsAdvancedOpen(event.currentTarget.open)}
      open={isAdvancedOpen}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
        <ChevronDown
          aria-hidden="true"
          className="size-4 transition-transform group-open:rotate-180"
        />
        Anotações e anexos
        {pendingFiles.length ? (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand-strong text-xs">
            {pendingFiles.length} {pendingFiles.length === 1 ? "anexo" : "anexos"}
          </span>
        ) : null}
      </summary>

      <div className="mt-4 grid gap-4">
        <form.Field name="note">
          {(field) => (
            <FieldShell
              error={getTransactionFormErrorMessage("note", field.state.meta.errors)}
              label="Observação"
            >
              <Textarea
                aria-invalid={field.state.meta.errors.length > 0}
                disabled={isSubmitting}
                maxLength={1000}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Adicione observações sobre o lançamento"
                rows={1}
                value={field.state.value}
              />
            </FieldShell>
          )}
        </form.Field>
        <TransactionAttachmentsField
          pendingFiles={pendingFiles}
          setPendingFiles={setPendingFiles}
          transaction={transaction}
          onAttachmentBusyChange={onAttachmentBusyChange}
          mode={mode}
          values={values}
          isSubmitting={isSubmitting}
        />
      </div>
    </details>
  );
}
