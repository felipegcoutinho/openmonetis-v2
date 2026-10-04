import { invoicePaymentCategoryName } from "@openmonetis/domain/categories";
import {
  ImportTransactionsInputSchema,
  type TransactionImportPreview,
} from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";

import { useRef, useState } from "react";
import {
  currentPeriod,
  findCategoryByImportedName,
  getCommonRowValue,
  haveDifferentRowValues,
} from "./components/transaction-import-review";
import type { Props, ReviewRow } from "./components/transaction-import-screen.types";
import {
  acceptedExtensions,
  type accountPaymentMethods,
} from "./components/transaction-import-screen-options";
import { getTransactionMutationErrorMessage } from "./transactions.presentation";

export function useTransactionImportReview({
  categories,
  people,
  onPreview,
  onDownloadTemplate,
  onImport,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importCompletedRef = useRef(false);
  const [preview, setPreview] = useState<TransactionImportPreview | null>(null);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const selectableCategories = categories.filter(
    (category) => category.name !== invoicePaymentCategoryName,
  );
  const form = useForm({
    defaultValues: {
      destination: "",
      paymentMethod: "pix" as (typeof accountPaymentMethods)[number] | "credit_card",
      invoicePeriod: currentPeriod(),
    },
    onSubmit: async ({ value }) => {
      if (!preview) {
        setError("Selecione um arquivo para importar.");
        return;
      }
      const [destinationType, destinationId] = value.destination.split(":") as [
        "account" | "card",
        string,
      ];
      const parsed = ImportTransactionsInputSchema.safeParse({
        sourceFingerprint: preview.sourceFingerprint,
        destinationType,
        destinationId,
        paymentMethod: value.paymentMethod,
        invoicePeriod: destinationType === "card" ? value.invoicePeriod : null,
        rows: rows
          .filter((row) => row.selected)
          .map((row) => ({
            externalId: row.externalId,
            purchaseDate: row.purchaseDate,
            amount: row.amount,
            name: row.name,
            type: row.type,
            personId: row.personId,
            categoryId: row.categoryId,
          })),
      });
      if (!parsed.success) {
        setError("Preencha a conta, a pessoa e a categoria dos lançamentos selecionados.");
        return;
      }
      setError(null);
      importCompletedRef.current = false;
      try {
        await onImport(parsed.data, () => {
          importCompletedRef.current = true;
        });
      } catch (error) {
        setError(getTransactionMutationErrorMessage(error));
      }
    },
  });

  const selectedRows = rows.filter((row) => row.selected);
  const incompleteRows = selectedRows.filter((row) => !row.personId || !row.categoryId);
  const duplicateCount = rows.filter((row) => row.isDuplicate).length;
  const allAvailableSelected = rows.filter((row) => !row.isDuplicate).every((row) => row.selected);
  const selectedExpenseRows = selectedRows.filter((row) => row.type === "expense");
  const selectedIncomeRows = selectedRows.filter((row) => row.type === "income");
  const commonPersonId = getCommonRowValue(selectedRows, (row) => row.personId);
  const commonExpenseCategoryId = getCommonRowValue(selectedExpenseRows, (row) => row.categoryId);
  const commonIncomeCategoryId = getCommonRowValue(selectedIncomeRows, (row) => row.categoryId);
  const selectedPeopleDiffer = haveDifferentRowValues(selectedRows, (row) => row.personId);
  const selectedExpenseCategoriesDiffer = haveDifferentRowValues(
    selectedExpenseRows,
    (row) => row.categoryId,
  );
  const selectedIncomeCategoriesDiffer = haveDifferentRowValues(
    selectedIncomeRows,
    (row) => row.categoryId,
  );

  async function handleFile(file: File) {
    importCompletedRef.current = false;
    setError(null);
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    if (!acceptedExtensions.includes(extension)) {
      setError("Formato não suportado. Use OFX, QFX ou XLSX.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O arquivo deve ter no máximo 5 MB.");
      return;
    }
    try {
      const result = await onPreview(file);
      const defaultPersonId =
        people.find((person) => person.role === "admin")?.id ?? people[0]?.id ?? "";
      const destination = "";
      form.reset({
        destination,
        paymentMethod: result.isCreditCard ? "credit_card" : "pix",
        invoicePeriod: result.period?.to.slice(0, 7) ?? currentPeriod(),
      });
      setRows(
        result.transactions.map((transaction) => ({
          ...transaction,
          rowKey: crypto.randomUUID(),
          selected: !transaction.isDuplicate,
          personId: defaultPersonId,
          categoryId: findCategoryByImportedName(categories, transaction),
        })),
      );
      setPreview(result);
    } catch {
      setError("Não foi possível ler o arquivo. Verifique o formato e tente novamente.");
    }
  }

  function updateSelectedRows(update: (row: ReviewRow) => ReviewRow) {
    setRows((current) => current.map((row) => (row.selected ? update(row) : row)));
  }

  function resetUpload() {
    importCompletedRef.current = false;
    setPreview(null);
    setRows([]);
    setError(null);
    form.reset();
  }

  async function downloadTemplate() {
    setError(null);
    try {
      const template = await onDownloadTemplate();
      const bytes = Uint8Array.from(atob(template.contentBase64), (character) =>
        character.charCodeAt(0),
      );
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        }),
      );
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = template.fileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Não foi possível baixar o modelo.");
    }
  }

  return {
    inputRef,
    importCompletedRef,
    preview,
    rows,
    setRows,
    error,
    dragging,
    setDragging,
    selectableCategories,
    form,
    selectedRows,
    incompleteRows,
    duplicateCount,
    allAvailableSelected,
    selectedExpenseRows,
    selectedIncomeRows,
    commonPersonId,
    commonExpenseCategoryId,
    commonIncomeCategoryId,
    selectedPeopleDiffer,
    selectedExpenseCategoriesDiffer,
    selectedIncomeCategoriesDiffer,
    handleFile,
    updateSelectedRows,
    resetUpload,
    downloadTemplate,
  };
}

export type TransactionImportScreenApi = ReturnType<typeof useTransactionImportReview>["form"];
