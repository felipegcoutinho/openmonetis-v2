import { ReceiptText, RotateCcw } from "lucide-react";
import { MobilePageFormGuard } from "@/components/forms/mobile-page-form-guard";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactionImportReview } from "../useTransactionImportReview";
import { TransactionImportReviewTable } from "./transaction-import-review-table";
import type { Props } from "./transaction-import-screen.types";
import { TransactionImportSettings } from "./transaction-import-settings";
import { TransactionImportSummary } from "./transaction-import-summary";
import { TransactionImportUpload } from "./transaction-import-upload";

export function TransactionImportScreen({
  accounts,
  cards,
  categories,
  people,
  isLoadingOptions,
  isDownloadingTemplate,
  isPreviewing,
  isImporting,
  onPreview,
  onDownloadTemplate,
  onImport,
}: Props) {
  const {
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
  } = useTransactionImportReview({
    accounts,
    cards,
    categories,
    people,
    isLoadingOptions,
    isDownloadingTemplate,
    isPreviewing,
    isImporting,
    onPreview,
    onDownloadTemplate,
    onImport,
  });
  return (
    <section className="app-page project-container">
      <PageHeader
        breadcrumbs={[
          { label: "Visão geral", href: "/dashboard" },
          { label: "Lançamentos", href: "/transactions" },
          { label: "Importar extrato" },
        ]}
        description="Revise os lançamentos do arquivo antes de adicioná-los à sua conta."
        icon={<ReceiptText aria-hidden="true" className="size-5" />}
        title="Importar extrato"
      />

      {!preview ? (
        <TransactionImportUpload
          inputRef={inputRef}
          dragging={dragging}
          setDragging={setDragging}
          handleFile={handleFile}
          downloadTemplate={downloadTemplate}
          isLoadingOptions={isLoadingOptions}
          isDownloadingTemplate={isDownloadingTemplate}
          isPreviewing={isPreviewing}
        />
      ) : (
        <form
          data-mobile-page-form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Subscribe
            selector={(state) => ({
              isDirty: Boolean(preview) || !state.isDefaultValue,
              isSubmitting: state.isSubmitting,
            })}
          >
            {(state) => (
              <MobilePageFormGuard {...state} canLeave={() => importCompletedRef.current} />
            )}
          </form.Subscribe>
          <TransactionImportSummary
            preview={preview}
            rows={rows}
            selectedRows={selectedRows}
            incompleteRows={incompleteRows}
            duplicateCount={duplicateCount}
          />

          <TransactionImportSettings
            selectableCategories={selectableCategories}
            form={form}
            selectedRows={selectedRows}
            selectedExpenseRows={selectedExpenseRows}
            selectedIncomeRows={selectedIncomeRows}
            commonPersonId={commonPersonId}
            commonExpenseCategoryId={commonExpenseCategoryId}
            commonIncomeCategoryId={commonIncomeCategoryId}
            selectedPeopleDiffer={selectedPeopleDiffer}
            selectedExpenseCategoriesDiffer={selectedExpenseCategoriesDiffer}
            selectedIncomeCategoriesDiffer={selectedIncomeCategoriesDiffer}
            updateSelectedRows={updateSelectedRows}
            accounts={accounts}
            cards={cards}
            people={people}
          />

          <TransactionImportReviewTable
            rows={rows}
            setRows={setRows}
            selectableCategories={selectableCategories}
            allAvailableSelected={allAvailableSelected}
            people={people}
          />

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button disabled={isImporting} onClick={resetUpload} type="button" variant="outline">
              <RotateCcw />
              Escolher outro arquivo
            </Button>
            <form.Subscribe selector={(state) => state.values.destination}>
              {(destination) => (
                <Button
                  disabled={
                    isImporting || !selectedRows.length || incompleteRows.length > 0 || !destination
                  }
                  type="submit"
                >
                  {isImporting
                    ? "Importando..."
                    : `Importar ${selectedRows.length} lançamentos para ${[...accounts, ...cards].find((entity) => destination.endsWith(`:${entity.id}`))?.name ?? "o destino escolhido"}`}
                </Button>
              )}
            </form.Subscribe>
          </div>
        </form>
      )}
      {isLoadingOptions ? <Skeleton className="h-9 w-full" /> : null}
      {!preview && error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
