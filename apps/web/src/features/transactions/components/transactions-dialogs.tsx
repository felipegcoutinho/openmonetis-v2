import { InstallmentAnticipationLauncher } from "@/features/installments/components/installment-anticipation-launcher";
import { InstallmentAnticipationUndoDialog } from "@/features/installments/components/installment-anticipation-undo-dialog";
import type { useTransactionsDialogs } from "../useTransactionsDialogs";

import { TransactionDetailsSheet } from "./transaction-details-sheet";
import { TransactionDialog } from "./transaction-dialog";
import { TransactionRefundDialog } from "./transaction-refund-dialog";

import type { TransactionsScreenProps } from "./transactions-screen.types";

export function TransactionsDialogs({
  accounts,
  cards,
  categories,
  people,
  period,
  pendingTransactionId,
  pendingSettlementKey,
  onDeleteTransaction,
  onSettleTransactions,
  onSettleRecurringOccurrence,
  onRecurringStatus,
  createDefaults,
  isDialogOpen,
  setIsDialogOpen,
  editingTransaction,
  setEditingTransaction,
  dialogMode,
  setDialogMode,
  createType,
  anticipatingTransaction,
  setAnticipatingTransaction,
  undoingAnticipation,
  setUndoingAnticipation,
  refundingTransaction,
  setRefundingTransaction,
  viewingTransaction,
  setViewingTransaction,
  openEditDialog,
  openCopyDialog,
  isMobile,
}: {
  accounts: TransactionsScreenProps["accounts"];
  cards: TransactionsScreenProps["cards"];
  categories: TransactionsScreenProps["categories"];
  people: TransactionsScreenProps["people"];
  period: TransactionsScreenProps["period"];
  pendingTransactionId: TransactionsScreenProps["pendingTransactionId"];
  pendingSettlementKey: TransactionsScreenProps["pendingSettlementKey"];
  onDeleteTransaction: TransactionsScreenProps["onDeleteTransaction"];
  onSettleTransactions: TransactionsScreenProps["onSettleTransactions"];
  onSettleRecurringOccurrence: TransactionsScreenProps["onSettleRecurringOccurrence"];
  onRecurringStatus: TransactionsScreenProps["onRecurringStatus"];
  createDefaults: TransactionsScreenProps["createDefaults"];
  isDialogOpen: ReturnType<typeof useTransactionsDialogs>["isDialogOpen"];
  setIsDialogOpen: ReturnType<typeof useTransactionsDialogs>["setIsDialogOpen"];
  editingTransaction: ReturnType<typeof useTransactionsDialogs>["editingTransaction"];
  setEditingTransaction: ReturnType<typeof useTransactionsDialogs>["setEditingTransaction"];
  dialogMode: ReturnType<typeof useTransactionsDialogs>["dialogMode"];
  setDialogMode: ReturnType<typeof useTransactionsDialogs>["setDialogMode"];
  createType: ReturnType<typeof useTransactionsDialogs>["createType"];
  anticipatingTransaction: ReturnType<typeof useTransactionsDialogs>["anticipatingTransaction"];
  setAnticipatingTransaction: ReturnType<
    typeof useTransactionsDialogs
  >["setAnticipatingTransaction"];
  undoingAnticipation: ReturnType<typeof useTransactionsDialogs>["undoingAnticipation"];
  setUndoingAnticipation: ReturnType<typeof useTransactionsDialogs>["setUndoingAnticipation"];
  refundingTransaction: ReturnType<typeof useTransactionsDialogs>["refundingTransaction"];
  setRefundingTransaction: ReturnType<typeof useTransactionsDialogs>["setRefundingTransaction"];
  viewingTransaction: ReturnType<typeof useTransactionsDialogs>["viewingTransaction"];
  setViewingTransaction: ReturnType<typeof useTransactionsDialogs>["setViewingTransaction"];
  openEditDialog: ReturnType<typeof useTransactionsDialogs>["openEditDialog"];
  openCopyDialog: ReturnType<typeof useTransactionsDialogs>["openCopyDialog"];
  isMobile: boolean | null;
}) {
  return (
    <>
      <TransactionDialog
        accounts={accounts}
        cards={cards}
        categories={categories}
        createDefaults={createDefaults}
        createTitle={
          createType === "income" && createDefaults?.paymentMethod === "credit_card"
            ? "Novo crédito na fatura"
            : undefined
        }
        createDescription={
          createType === "income" && createDefaults?.paymentMethod === "credit_card"
            ? "Registre um crédito recebido no cartão. Para reembolsar uma despesa específica, use a ação de reembolso desse lançamento."
            : undefined
        }
        defaultType={createType}
        defaultPeriod={period}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setEditingTransaction(null);
          if (!open) setDialogMode("create");
        }}
        open={isDialogOpen}
        people={people}
        mode={dialogMode}
        transaction={editingTransaction}
      />
      <TransactionDetailsSheet
        key={`details-${viewingTransaction?.id ?? "closed"}`}
        mobileActions={
          isMobile === true
            ? {
                onAnticipate: setAnticipatingTransaction,
                onCopy: openCopyDialog,
                onDelete: onDeleteTransaction,
                onRecurringStatus,
                onRefund: setRefundingTransaction,
                onSettle: onSettleTransactions,
                onSettleRecurringOccurrence,
                onUndoAnticipation: setUndoingAnticipation,
                pendingSettlementKey,
                pendingTransactionId,
              }
            : undefined
        }
        onEdit={openEditDialog}
        onOpenChange={(open) => {
          if (!open) setViewingTransaction(null);
        }}
        open={Boolean(viewingTransaction)}
        transaction={viewingTransaction}
      />
      <TransactionRefundDialog
        defaultPeriod={period}
        key={`refund-${refundingTransaction?.recordId ?? "closed"}`}
        onOpenChange={(open) => {
          if (!open) setRefundingTransaction(null);
        }}
        open={Boolean(refundingTransaction)}
        transaction={refundingTransaction}
      />
      <InstallmentAnticipationLauncher
        key={`anticipation-${anticipatingTransaction?.seriesId ?? "closed"}`}
        onOpenChange={(open) => {
          if (!open) setAnticipatingTransaction(null);
        }}
        open={Boolean(anticipatingTransaction)}
        targetPeriod={period}
        transaction={anticipatingTransaction}
      />
      <InstallmentAnticipationUndoDialog
        key={`undo-anticipation-${undoingAnticipation?.anticipationId ?? "closed"}`}
        onOpenChange={(open) => {
          if (!open) setUndoingAnticipation(null);
        }}
        open={Boolean(undoingAnticipation)}
        transaction={undoingAnticipation}
      />
    </>
  );
}
