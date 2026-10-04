import type { TransactionInput } from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { useImperativeHandle, useMemo, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { showInvalidFormToast } from "@/lib/form-feedback";
import type { TransactionFormProps } from "./components/transaction-form.types";
import {
  getDefaultTransactionFormValues,
  getTransactionFormValuesFromTransaction,
  type TransactionFormValues,
  validateTransactionForm,
} from "./components/transaction-form.validation";
import type { TransactionRelatedRecordKind } from "./components/transaction-related-record-dialog";
import { useTransactionFormSubmission } from "./useTransactionFormSubmission";

export function useTransactionForm({
  accounts,
  cards,
  people,
  transaction,
  mode = transaction ? "edit" : "create",
  defaultType = "expense",
  defaultPeriod,
  createDefaults,
  onCreate,
  onCreated,
  onSaved,
  ref,
}: TransactionFormProps) {
  const mobile = useIsMobile();

  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingInstallmentUpdate, setPendingInstallmentUpdate] = useState<{
    data: TransactionInput;
    value: TransactionFormValues;
  } | null>(null);
  const [pendingRecurringUpdate, setPendingRecurringUpdate] = useState<TransactionInput | null>(
    null,
  );
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(mode !== "edit" && Boolean(transaction));
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts],
  );
  const activeCards = useMemo(() => cards.filter((card) => card.status === "active"), [cards]);
  const activePeople = useMemo(
    () => people.filter((person) => person.status === "active"),
    [people],
  );
  const adminPerson = activePeople.find((person) => person.role === "admin");
  const defaultValues = useMemo(
    () =>
      transaction
        ? getTransactionFormValuesFromTransaction(
            transaction,
            accounts,
            cards,
            people,
            mode === "copy" ? "copy" : "edit",
          )
        : getDefaultTransactionFormValues(
            accounts,
            cards,
            people,
            defaultType,
            defaultPeriod,
            createDefaults,
          ),
    [accounts, cards, createDefaults, defaultPeriod, defaultType, mode, people, transaction],
  );
  const [relatedAccountField, setRelatedAccountField] = useState<
    "accountId" | "sourceAccountId" | "destinationAccountId"
  >("accountId");
  const [relatedRecord, setRelatedRecord] = useState<TransactionRelatedRecordKind | null>(null);
  const { submit, persistTransactionUpdate, updateTransaction, updateRecurringRule } =
    useTransactionFormSubmission({
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
      resetForm: () =>
        form.reset(
          getDefaultTransactionFormValues(
            accounts,
            cards,
            people,
            defaultType,
            defaultPeriod,
            createDefaults,
          ),
        ),
    });
  const form = useForm({
    defaultValues,
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: validateTransactionForm,
    },
    onSubmit: submit,
  });

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => form.state.isDirty || pendingFiles.length > 0,
    isSubmitting: () => form.state.isSubmitting,
  }));

  function handleTypeChange(value: TransactionFormValues["type"]) {
    form.setFieldValue("type", value);
    form.setFieldValue("categoryId", "");

    if (value === "transfer") {
      form.setFieldValue("paymentMethod", "bank_transfer");
      form.setFieldValue("condition", "single");
      form.setFieldValue("personId", adminPerson?.id ?? "");
      form.setFieldValue("isSettled", "false");
      form.setFieldValue("boletoPaymentDate", "");
      form.setFieldValue("splitShares", []);
      form.setFieldValue("accountId", "");
      form.setFieldValue("cardId", "");
      form.setFieldValue(
        "sourceAccountId",
        form.getFieldValue("sourceAccountId") || activeAccounts[0]?.id || "",
      );
      form.setFieldValue("destinationAccountId", "");
    }
  }

  function handlePersonChange(personId: string) {
    form.setFieldValue("personId", personId);
  }

  function handlePaymentMethodChange(value: TransactionFormValues["paymentMethod"]) {
    form.setFieldValue("paymentMethod", value);

    if (value === "credit_card") {
      form.setFieldValue("accountId", "");
      form.setFieldValue("cardId", form.getFieldValue("cardId") || activeCards[0]?.id || "");
      form.setFieldValue("isSettled", "true");
      form.setFieldValue("boletoPaymentDate", "");
      return;
    }

    form.setFieldValue("cardId", "");
    form.setFieldValue("accountId", form.getFieldValue("accountId") || activeAccounts[0]?.id || "");
    form.setFieldValue("isSettled", "false");
    form.setFieldValue("boletoPaymentDate", "");
  }

  function handleCardChange(cardId: string) {
    if (cardId === form.getFieldValue("cardId")) return;
    form.setFieldValue("cardId", cardId);
    form.setFieldValue("invoicePeriod", "");
  }

  return {
    mobile,
    updateTransaction,
    updateRecurringRule,
    pendingFiles,
    setPendingFiles,
    pendingInstallmentUpdate,
    setPendingInstallmentUpdate,
    pendingRecurringUpdate,
    setPendingRecurringUpdate,
    isAdvancedOpen,
    setIsAdvancedOpen,
    activeAccounts,
    activeCards,
    activePeople,
    relatedAccountField,
    setRelatedAccountField,
    relatedRecord,
    setRelatedRecord,
    form,
    persistTransactionUpdate,
    handleTypeChange,
    handlePersonChange,
    handlePaymentMethodChange,
    handleCardChange,
  };
}

export type TransactionFormApi = ReturnType<typeof useTransactionForm>["form"];
