import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import type { useTransactionImportReview } from "../useTransactionImportReview";
import { TransactionImportBulkActions } from "./transaction-import-bulk-actions";
import { TransactionImportDestination } from "./transaction-import-destination";

import type { Props } from "./transaction-import-screen.types";

export function TransactionImportSettings({
  selectableCategories,
  form,
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
  accounts,
  cards,
  people,
}: {
  selectableCategories: ReturnType<typeof useTransactionImportReview>["selectableCategories"];
  form: ReturnType<typeof useTransactionImportReview>["form"];
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
  accounts: Props["accounts"];
  cards: Props["cards"];
  people: Props["people"];
}) {
  return (
    <form.Subscribe selector={(state) => state.values}>
      {(values) => {
        const isCard = values.destination.startsWith("card:");
        const selectedAccount = values.destination.startsWith("account:")
          ? accounts.find((account) => `account:${account.id}` === values.destination)
          : undefined;
        const selectedCard = values.destination.startsWith("card:")
          ? cards.find((card) => `card:${card.id}` === values.destination)
          : undefined;
        const commonPerson = people.find((person) => person.id === commonPersonId);
        return (
          <Card className="border" aria-labelledby="import-settings-title">
            <CardHeader className="border-b">
              <CardTitle id="import-settings-title">Aplicar aos selecionados</CardTitle>
              <CardDescription>
                Defina os dados em lote. Depois, ajuste exceções diretamente na lista.
              </CardDescription>
              <CardAction>
                <Badge variant="secondary">{selectedRows.length} selecionados</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="grid gap-6">
              <TransactionImportDestination
                form={form}
                accounts={accounts}
                cards={cards}
                isCard={isCard}
                selectedAccount={selectedAccount}
                selectedCard={selectedCard}
              />

              <TransactionImportBulkActions
                selectableCategories={selectableCategories}
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
                people={people}
                commonPerson={commonPerson}
              />
            </CardContent>
          </Card>
        );
      }}
    </form.Subscribe>
  );
}
