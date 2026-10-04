import { CircleDollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { groupTransactionRows } from "../transactions.presentation";
import { useTransactionSelection } from "../useTransactionSelection";
import { TransactionRow } from "./transaction-row";
import { TransactionSelectionSummary } from "./transaction-selection-summary";
import { TransactionsPagination } from "./transactions-pagination";
import type { TransactionsTableProps } from "./transactions-table.types";

export function TransactionsTable({
  accountStatement = false,
  adminPersonId,
  transactions,
  pendingTransactionId,
  pendingSettlementKey,
  onEdit,
  onView,
  onDelete,
  onCopy,
  onAnticipate,
  onUndoAnticipation,
  onRefund,
  onSettle,
  onSettleRecurringOccurrence,
  onRecurringStatus,
  currentPage,
  pageCount,
  pageSize,
  period,
  totalItems,
  onPageChange,
  onPageSizeChange,
}: TransactionsTableProps) {
  const selection = useTransactionSelection(transactions);

  return (
    <TooltipProvider>
      <div className="grid gap-3">
        <TransactionSelectionSummary onClear={selection.clear} summary={selection.summary} />
        <Card className="py-2">
          <CardContent className="px-2 sm:px-4">
            {transactions.length ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            aria-label="Selecionar lançamentos operacionais desta página"
                            checked={selection.allSelectableSelected}
                            disabled={!selection.selectableCount}
                            onCheckedChange={selection.setAllSelectableSelected}
                          />
                        </TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                        <TableHead className="pl-5">Condição</TableHead>
                        <TableHead>Forma</TableHead>
                        <TableHead>Conta/Cartão</TableHead>
                        <TableHead className="w-24 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupTransactionRows(transactions).map(({ transaction, splitConnector }) => (
                        <TransactionRow
                          accountStatement={accountStatement}
                          adminPersonId={adminPersonId}
                          key={transaction.id}
                          selected={selection.isSelected(transaction.id)}
                          selectable={selection.isSelectable(transaction)}
                          splitConnector={splitConnector}
                          onEdit={onEdit}
                          onView={onView}
                          onDelete={onDelete}
                          onCopy={onCopy}
                          onAnticipate={onAnticipate}
                          onUndoAnticipation={onUndoAnticipation}
                          onRefund={onRefund}
                          onRecurringStatus={onRecurringStatus}
                          onSettle={onSettle}
                          onSettleRecurringOccurrence={onSettleRecurringOccurrence}
                          onSelectionChange={(selected) =>
                            selection.setSelected(transaction.id, selected)
                          }
                          pending={
                            pendingTransactionId !== null &&
                            pendingTransactionId === transaction.recordId
                          }
                          period={period}
                          settlementPending={
                            pendingSettlementKey ===
                            (transaction.recordId ??
                              (transaction.recurringRuleId
                                ? `${transaction.recurringRuleId}:${transaction.purchaseDate}`
                                : null))
                          }
                          transaction={transaction}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <TransactionsPagination
                  totalItems={totalItems}
                  currentPage={currentPage}
                  pageCount={pageCount}
                  pageSize={pageSize}
                  onPageChange={onPageChange}
                  onPageSizeChange={onPageSizeChange}
                />
              </>
            ) : (
              <div className="grid place-items-center px-4 py-14 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-brand/10 text-brand-strong">
                  <CircleDollarSign className="size-6" />
                </span>
                <h2 className="mt-4 font-semibold">Nenhum lançamento encontrado</h2>
                <p className="mt-1 max-w-sm text-muted-foreground text-sm">
                  Ajuste os filtros ou cadastre um novo lançamento para visualizar aqui.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}
