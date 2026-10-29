import {
  isTransactionSelectionItemSelectable,
  summarizeTransactionSelection,
} from "@openmonetis/domain/transactions";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useEffect, useRef, useState } from "react";

function visibleAmount(transaction: TransactionOutput) {
  return transaction.allocation?.amount ?? transaction.amount;
}

export function useTransactionSelection(transactions: readonly TransactionOutput[]) {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(() => new Set());
  const anchorId = useRef<string | null>(null);
  const hasSelection = selectedIds.size > 0;

  useEffect(() => {
    if (!hasSelection) return;
    function clearOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target instanceof Element ? event.target : null;
      // Escape belongs to open overlays and text fields before it clears the selection.
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (document.querySelector("[role='dialog'], [role='menu'], [role='listbox']")) return;
      anchorId.current = null;
      setSelectedIds(new Set());
    }
    document.addEventListener("keydown", clearOnEscape);
    return () => document.removeEventListener("keydown", clearOnEscape);
  }, [hasSelection]);
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

  /** With `extendRange`, applies the same state to every selectable row since the last click. */
  function setSelected(id: string, selected: boolean, extendRange = false) {
    const anchorIndex = anchorId.current
      ? transactions.findIndex((item) => item.id === anchorId.current)
      : -1;
    const targetIndex = transactions.findIndex((item) => item.id === id);
    const range =
      extendRange && anchorIndex >= 0 && targetIndex >= 0
        ? transactions.slice(
            Math.min(anchorIndex, targetIndex),
            Math.max(anchorIndex, targetIndex) + 1,
          )
        : transactions.filter((item) => item.id === id);
    anchorId.current = id;
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const transaction of range) {
        if (selected && isTransactionSelectionItemSelectable(transaction)) next.add(transaction.id);
        else next.delete(transaction.id);
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
    clear: () => {
      anchorId.current = null;
      setSelectedIds(new Set());
    },
    selectableCount: selectableTransactions.length,
    isSelected: (id: string) => selectedIds.has(id),
    selectedTransactions,
    isSelectable: (transaction: TransactionOutput) =>
      isTransactionSelectionItemSelectable(transaction),
    setAllSelectableSelected,
    setSelected,
    summary,
  };
}
