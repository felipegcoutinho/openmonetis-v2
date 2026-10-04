import { AttachmentFilePicker } from "@/features/attachments/components/attachment-file-picker";
import { TransactionAttachments } from "@/features/attachments/components/transaction-attachments";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";
import type { TransactionFormProps } from "./transaction-form.types";
import type { TransactionFormValues } from "./transaction-form.validation";

export function TransactionAttachmentsField({
  pendingFiles,
  setPendingFiles,
  transaction,
  onAttachmentBusyChange,
  mode,
  values,
  isSubmitting,
}: {
  pendingFiles: ReturnType<typeof useTransactionForm>["pendingFiles"];
  setPendingFiles: ReturnType<typeof useTransactionForm>["setPendingFiles"];
  transaction: TransactionFormProps["transaction"];
  onAttachmentBusyChange: TransactionFormProps["onAttachmentBusyChange"];
  mode: "create" | "edit" | "copy";
  values: TransactionFormValues;
  isSubmitting: boolean;
}) {
  return (
    <>
      {mode === "edit" ? (
        <FieldShell label="Anexos">
          {transaction?.recordId ? (
            <TransactionAttachments
              onBusyChange={onAttachmentBusyChange}
              transactionId={transaction.recordId}
            />
          ) : (
            <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs">
              Anexos ficam disponíveis em ocorrências já registradas.
            </p>
          )}
        </FieldShell>
      ) : values.condition === "recurring" ? (
        <FieldShell label="Anexos">
          <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs">
            Anexos poderão ser adicionados quando houver um lançamento registrado para a
            recorrência.
          </p>
        </FieldShell>
      ) : (
        <FieldShell label="Anexos">
          <AttachmentFilePicker
            disabled={isSubmitting}
            files={pendingFiles}
            onAdd={(file) => setPendingFiles((current) => [...current, file])}
            onRemove={(file) =>
              setPendingFiles((current) => current.filter((item) => item !== file))
            }
          />
          {values.condition === "installment" ? (
            <p className="text-muted-foreground text-xs">
              Os anexos desta compra ficam vinculados à primeira parcela.
            </p>
          ) : null}
        </FieldShell>
      )}
    </>
  );
}
