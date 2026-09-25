import {
  isTransactionSelectionItemSelectable,
  summarizeTransactionSelection,
} from "@openmonetis/domain/transactions";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useState } from "react";

function visibleAmount(transaction: TransactionOutput) {
  return transaction.allocation?.amount ?? transaction.amount;
}

export function useTransactionSelection(transactions: readonly TransactionOutput[]) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const selectedTransactions = transactions.filter(
    (transaction) =>
      isTransactionSelectionItemSelectable(transaction) && selectedIds.has(transaction.id),
  );
  const selectableTransactions = transactions.filter(isTransactionSelectionItemSelectable);
  const allSelectableSelected =
    selectableTransactions.length > 0 &&
    selectableTransactions.every((transaction) => selectedIds.has(transaction.id));
  const summary = summarizeTransactionSelection(
    selectedTransactions.map((transaction) => ({
      amount: visibleAmount(transaction),
      origin: transaction.origin,
      type: transaction.type,
    })),
  );

  function setSelected(id: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      const transaction = transactions.find((item) => item.id === id);
      if (selected && transaction && isTransactionSelectionItemSelectable(transaction)) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  function setAllSelectableSelected(selected: boolean) {
    if (!selected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectableTransactions.map((transaction) => transaction.id)));
  }

  return {
    allSelectableSelected,
    clear: () => setSelectedIds(new Set()),
    selectableCount: selectableTransactions.length,
    isSelected: (id: string) => selectedIds.has(id),
    isSelectable: (transaction: TransactionOutput) =>
      isTransactionSelectionItemSelectable(transaction),
    setAllSelectableSelected,
    setSelected,
    summary,
  };
}
