import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";

import { useState } from "react";

export function useTransactionsDialogs() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionOutput | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "copy">("create");
  const [createType, setCreateType] = useState<TransactionInput["type"]>("expense");
  const [anticipatingTransaction, setAnticipatingTransaction] = useState<TransactionOutput | null>(
    null,
  );
  const [undoingAnticipation, setUndoingAnticipation] = useState<TransactionOutput | null>(null);
  const [refundingTransaction, setRefundingTransaction] = useState<TransactionOutput | null>(null);
  const [viewingTransaction, setViewingTransaction] = useState<TransactionOutput | null>(null);
  function openCreateDialog(type: TransactionInput["type"]) {
    setCreateType(type);
    setDialogMode("create");
    setEditingTransaction(null);
    setIsDialogOpen(true);
  }
  function openEditDialog(transaction: TransactionOutput) {
    setEditingTransaction(transaction);
    setCreateType(transaction.type);
    setDialogMode("edit");
    setIsDialogOpen(true);
  }
  function openCopyDialog(transaction: TransactionOutput) {
    setEditingTransaction(transaction);
    setCreateType(transaction.type);
    setDialogMode("copy");
    setIsDialogOpen(true);
  }
  return {
    isDialogOpen,
    setIsDialogOpen,
    editingTransaction,
    setEditingTransaction,
    dialogMode,
    setDialogMode,
    createType,
    setCreateType,
    anticipatingTransaction,
    setAnticipatingTransaction,
    undoingAnticipation,
    setUndoingAnticipation,
    refundingTransaction,
    setRefundingTransaction,
    viewingTransaction,
    setViewingTransaction,
    openCreateDialog,
    openEditDialog,
    openCopyDialog,
  };
}
