import type { PersonOutput } from "@openmonetis/validators/people";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { useTransactionImportReview } from "../useTransactionImportReview";
import { BulkCategorySelect } from "./transaction-import-category-select";
import { Field, PersonOption } from "./transaction-import-options";
import type { Props } from "./transaction-import-screen.types";
export function TransactionImportBulkActions({
  selectableCategories,
  selectedRows,
  selectedExpenseRows,
  selectedIncomeRows,
  commonPersonId,
  commonExpenseCategoryId,
  commonIncomeCategoryId,
  selectedPeopleDiffer,
  selectedExpenseCategoriesDiffer,
  selectedIncomeCategoriesDiffer,
  updateSelectedRows,
  people,
  commonPerson,
}: {
  selectableCategories: ReturnType<typeof useTransactionImportReview>["selectableCategories"];
  selectedRows: ReturnType<typeof useTransactionImportReview>["selectedRows"];
  selectedExpenseRows: ReturnType<typeof useTransactionImportReview>["selectedExpenseRows"];
  selectedIncomeRows: ReturnType<typeof useTransactionImportReview>["selectedIncomeRows"];
  commonPersonId: ReturnType<typeof useTransactionImportReview>["commonPersonId"];
  commonExpenseCategoryId: ReturnType<typeof useTransactionImportReview>["commonExpenseCategoryId"];
  commonIncomeCategoryId: ReturnType<typeof useTransactionImportReview>["commonIncomeCategoryId"];
  selectedPeopleDiffer: ReturnType<typeof useTransactionImportReview>["selectedPeopleDiffer"];
  selectedExpenseCategoriesDiffer: ReturnType<
    typeof useTransactionImportReview
  >["selectedExpenseCategoriesDiffer"];
  selectedIncomeCategoriesDiffer: ReturnType<
    typeof useTransactionImportReview
  >["selectedIncomeCategoriesDiffer"];
  updateSelectedRows: ReturnType<typeof useTransactionImportReview>["updateSelectedRows"];
  people: Props["people"];
  commonPerson: PersonOutput | undefined;
}) {
  return (
    <section className="grid gap-3 border-t pt-6" aria-labelledby="bulk-settings-title">
      <div>
        <h3 className="font-medium text-sm" id="bulk-settings-title">
          Classificação em lote
        </h3>
        <p className="text-muted-foreground text-xs">
          Só os lançamentos marcados recebem as alterações abaixo.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Pessoa">
          <Select
            disabled={!selectedRows.length}
            onValueChange={(value) =>
              updateSelectedRows((row) => ({
                ...row,
                personId: value as string,
              }))
            }
            value={commonPersonId || null}
          >
            <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
              <SelectValue
                placeholder={
                  !selectedRows.length
                    ? "Nenhum lançamento selecionado"
                    : selectedPeopleDiffer
                      ? "Pessoas diferentes"
                      : "Selecione uma pessoa"
                }
              >
                <PersonOption
                  description={`${selectedRows.length} lançamento${selectedRows.length === 1 ? "" : "s"} selecionado${selectedRows.length === 1 ? "" : "s"}`}
                  person={commonPerson}
                />
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {people.map((person) => (
                <SelectItem key={person.id} value={person.id}>
                  <PersonOption person={person} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <BulkCategorySelect
          categories={selectableCategories.filter((category) => category.type === "expense")}
          label="Categoria das despesas"
          mixed={selectedExpenseCategoriesDiffer}
          onChange={(categoryId) =>
            updateSelectedRows((row) => (row.type === "expense" ? { ...row, categoryId } : row))
          }
          rowCount={selectedExpenseRows.length}
          value={commonExpenseCategoryId}
        />
        <BulkCategorySelect
          categories={selectableCategories.filter((category) => category.type === "income")}
          label="Categoria das receitas"
          mixed={selectedIncomeCategoriesDiffer}
          onChange={(categoryId) =>
            updateSelectedRows((row) => (row.type === "income" ? { ...row, categoryId } : row))
          }
          rowCount={selectedIncomeRows.length}
          value={commonIncomeCategoryId}
        />
      </div>
    </section>
  );
}
