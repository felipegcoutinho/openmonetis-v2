import type {
  TransactionActionScope,
  TransactionInput,
  UpdateTransactionInput,
} from "@openmonetis/validators/transactions";

import { useQueryClient } from "@tanstack/react-query";
import type { Dispatch, SetStateAction } from "react";
import { toast } from "sonner";
import { uploadAttachment } from "@/features/attachments/attachments.api";
import { attachmentKeys } from "@/features/attachments/attachments.queries";
import type { TransactionFormProps } from "./components/transaction-form.types";
import {
  getChangedTransactionInput,
  normalizeTransactionInput,
  type TransactionFormValues,
} from "./components/transaction-form.validation";
import {
  useCreateTransactionMutation,
  useUpdateRecurringRuleMutation,
  useUpdateTransactionMutation,
} from "./transactions.mutations";
import { getTransactionMutationErrorMessage } from "./transactions.presentation";
import { transactionKeys } from "./transactions.queries";
export function useTransactionFormSubmission({
  mode,
  transaction,
  onCreate,
  onCreated,
  onSaved,
  pendingFiles,
  setPendingFiles,
  setPendingRecurringUpdate,
  setPendingInstallmentUpdate,
  defaultValues,
  resetForm,
}: {
  mode: "create" | "edit" | "copy";
  transaction: TransactionFormProps["transaction"];
  onCreate: TransactionFormProps["onCreate"];
  onCreated: TransactionFormProps["onCreated"];
  onSaved: TransactionFormProps["onSaved"];
  pendingFiles: File[];
  setPendingFiles: Dispatch<SetStateAction<File[]>>;
  setPendingRecurringUpdate: Dispatch<SetStateAction<TransactionInput | null>>;
  setPendingInstallmentUpdate: Dispatch<
    SetStateAction<{ data: TransactionInput; value: TransactionFormValues } | null>
  >;
  defaultValues: TransactionFormValues;
  resetForm: () => void;
}) {
  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();
  const updateRecurringRule = useUpdateRecurringRuleMutation();
  const queryClient = useQueryClient();
  async function persistTransactionUpdate(
    data: TransactionInput,
    scope: TransactionActionScope,
    value?: TransactionFormValues,
  ) {
    const updateData: UpdateTransactionInput =
      scope === "single" || !value ? data : getChangedTransactionInput(data, value, defaultValues);
    await updateTransaction.mutateAsync({
      id: transaction?.recordId as string,
      data: updateData,
      scope,
    });
    setPendingInstallmentUpdate(null);
    toast.success("Lançamento atualizado", {
      description: `${data.name} foi atualizado com sucesso.`,
    });
    onSaved();
  }
  async function submit({ value }: { value: TransactionFormValues }) {
    try {
      const data = normalizeTransactionInput(value, {
        includeStartInstallment: mode !== "edit",
      });

      if (mode === "edit" && transaction?.isRecurring && transaction.recurringRuleId) {
        setPendingRecurringUpdate(data);
        return;
      }
      if (mode === "edit" && transaction?.recordId) {
        if (transaction.condition === "installment" && transaction.seriesId) {
          setPendingInstallmentUpdate({ data, value });
          return;
        }
        await persistTransactionUpdate(data, "single");
        return;
      }

      const created = onCreate ? await onCreate(data) : await createTransaction.mutateAsync(data);
      const uploadResults = created.recordId
        ? await Promise.allSettled(
            pendingFiles.map((file) => uploadAttachment(file, created.recordId as string)),
          )
        : [];
      const failedUploads = created.recordId
        ? uploadResults.filter((result) => result.status === "rejected").length
        : pendingFiles.length;

      if (pendingFiles.length) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: attachmentKeys.all }),
          queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
        ]);
      }

      if (failedUploads) {
        toast.warning("Lançamento salvo, mas houve falha nos anexos", {
          description:
            failedUploads === 1
              ? "1 arquivo não foi enviado. Edite o lançamento para tentar novamente."
              : `${failedUploads} arquivos não foram enviados. Edite o lançamento para tentar novamente.`,
        });
      } else {
        toast.success("Lançamento salvo", {
          description: `${data.name} foi cadastrado com sucesso.`,
        });
      }
      resetForm();
      setPendingFiles([]);
      if (onCreated) {
        try {
          await onCreated(created);
        } catch {
          toast.warning("Lançamento salvo, mas o pré-lançamento continua pendente.", {
            description: "Revise a caixa de pré-lançamentos antes de tentar novamente.",
          });
        }
      }
      onSaved();
    } catch (error) {
      toast.error("Não foi possível salvar o lançamento", {
        description: getTransactionMutationErrorMessage(error),
      });
    }
  }
  return { submit, persistTransactionUpdate, updateTransaction, updateRecurringRule };
}
