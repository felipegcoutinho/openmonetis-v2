import {
  allocateAmountByPercentages,
  analyzeTransactionSplitAllocation,
  rebalanceAmountShare,
  rebalancePercentageShare,
  rebalanceTwoAmountShares,
  rebalanceTwoPercentageShares,
  splitAmountEqually,
} from "@openmonetis/domain/transactions";
import { useQuery } from "@tanstack/react-query";

import { useState } from "react";

import { personConnectionsQueryOptions } from "@/features/person-connections/person-connections.queries";
import type {
  PercentageFormShare,
  SplitFormShare,
  SplitMode,
  TransactionSplitDialogProps,
} from "./components/transaction-split-dialog.types";
import {
  createEqualShares,
  createPercentageDraft,
  formatPercentageInput,
  getAllocationValue,
  normalizePercentageInput,
  parsePercentage,
} from "./components/transaction-split-input";

export function useTransactionSplitEditor({
  amount,
  disabled,
  onChange,
  people,
  primaryPersonId,
  value,
}: TransactionSplitDialogProps) {
  const connections = useQuery(personConnectionsQueryOptions());
  const [open, setOpen] = useState(false);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [draft, setDraft] = useState<SplitFormShare[]>(value);
  const [percentageDraft, setPercentageDraft] = useState<PercentageFormShare[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("amount");
  const [lastEditedPersonId, setLastEditedPersonId] = useState<string | null>(null);
  const [redistributionSelection, setRedistributionSelection] = useState<string | null>(null);
  const total = Number(amount) || 0;
  const committedAllocation = analyzeTransactionSplitAllocation({
    totalAmount: total,
    amounts: value.map((share) => share.amount),
    mode: "amount",
  });
  const isDivided = committedAllocation.canSave;
  const activeConnectedPersonIds = new Set(
    (connections.data ?? [])
      .filter((connection) => connection.perspective === "owner" && connection.status === "active")
      .flatMap((connection) => (connection.personId ? [connection.personId] : [])),
  );
  const connectedShares = value.filter((share) => activeConnectedPersonIds.has(share.personId));
  const connectedDraftShares = draft.filter((share) =>
    activeConnectedPersonIds.has(share.personId),
  );
  const cardDisabled = disabled || people.length < 2 || !primaryPersonId || total <= 0;

  function openEditor() {
    const initialDraft = value.length ? value : createEqualShares([primaryPersonId], total);
    setDraft(initialDraft);
    setPercentageDraft(createPercentageDraft(initialDraft, total));
    setLastEditedPersonId(null);
    setRedistributionSelection(null);
    setOpen(true);
  }

  function applyEqualSplit(shares = draft) {
    if (!shares.length) {
      setDraft([]);
      setPercentageDraft([]);
      setLastEditedPersonId(null);
      setRedistributionSelection(null);
      return;
    }
    const personIds = shares.map((share) => share.personId);
    if (splitMode === "percentage") {
      const percentages = splitAmountEqually(100, personIds.length);
      const amounts = allocateAmountByPercentages(total, percentages);
      setPercentageDraft(
        personIds.map((personId, index) => ({
          personId,
          percentage: formatPercentageInput(getAllocationValue(percentages, index)),
        })),
      );
      setDraft(
        personIds.map((personId, index) => ({
          personId,
          amount: getAllocationValue(amounts, index).toFixed(2),
        })),
      );
    } else {
      const nextDraft = createEqualShares(personIds, total);
      setDraft(nextDraft);
      setPercentageDraft(createPercentageDraft(nextDraft, total));
    }
    setLastEditedPersonId(null);
    setRedistributionSelection(null);
  }

  function togglePerson(personId: string, checked: boolean) {
    const nextDraft = checked
      ? [...draft, { personId, amount: "" }]
      : draft.filter((share) => share.personId !== personId);

    applyEqualSplit(nextDraft);
  }

  function updateAmount(personId: string, nextAmount: string) {
    const numericAmount = Number(nextAmount);
    if (
      draft.length === 2 &&
      Number.isFinite(numericAmount) &&
      numericAmount >= 0 &&
      numericAmount <= total
    ) {
      const [editedAmount, remainingAmount] = rebalanceTwoAmountShares(total, numericAmount);
      const nextDraft = draft.map((share) => ({
        ...share,
        amount: share.personId === personId ? editedAmount.toFixed(2) : remainingAmount.toFixed(2),
      }));
      setDraft(nextDraft);
      setPercentageDraft(createPercentageDraft(nextDraft, total));
      setLastEditedPersonId(null);
      setRedistributionSelection(null);
      return;
    }

    const nextDraft = draft.map((share) =>
      share.personId === personId ? { ...share, amount: nextAmount } : share,
    );
    setDraft(nextDraft);
    setPercentageDraft(createPercentageDraft(nextDraft, total));
    setLastEditedPersonId(personId);
    setRedistributionSelection(null);
  }

  function updatePercentage(personId: string, nextValue: string) {
    const nextPercentageDraft = percentageDraft.map((share) =>
      share.personId === personId
        ? { ...share, percentage: normalizePercentageInput(nextValue) }
        : share,
    );
    const numericPercentage = parsePercentage(nextValue);
    if (
      percentageDraft.length === 2 &&
      nextValue.trim() &&
      numericPercentage >= 0 &&
      numericPercentage <= 100
    ) {
      const [editedPercentage, remainingPercentage] =
        rebalanceTwoPercentageShares(numericPercentage);
      const balancedPercentages = nextPercentageDraft.map((share) => ({
        ...share,
        percentage:
          share.personId === personId
            ? formatPercentageInput(editedPercentage)
            : formatPercentageInput(remainingPercentage),
      }));
      const amounts = allocateAmountByPercentages(
        total,
        balancedPercentages.map((share) => parsePercentage(share.percentage)),
      );
      setPercentageDraft(balancedPercentages);
      setDraft(
        balancedPercentages.map((share, index) => ({
          personId: share.personId,
          amount: getAllocationValue(amounts, index).toFixed(2),
        })),
      );
      setLastEditedPersonId(null);
      setRedistributionSelection(null);
      return;
    }

    const amounts = allocateAmountByPercentages(
      total,
      nextPercentageDraft.map((share) => Math.min(100, parsePercentage(share.percentage))),
    );
    setPercentageDraft(nextPercentageDraft);
    setDraft(
      nextPercentageDraft.map((share, index) => ({
        personId: share.personId,
        amount: getAllocationValue(amounts, index).toFixed(2),
      })),
    );
    setLastEditedPersonId(personId);
    setRedistributionSelection(null);
  }

  function changeSplitMode(mode: SplitMode) {
    setSplitMode(mode);
    setRedistributionSelection(null);
  }

  function redistributeDifference(personId: string) {
    const targetIndex = draft.findIndex((share) => share.personId === personId);

    if (splitMode === "percentage") {
      const percentages = rebalancePercentageShare(
        percentageDraft.map((share) => parsePercentage(share.percentage)),
        targetIndex,
      );
      const amounts = allocateAmountByPercentages(total, percentages);
      setPercentageDraft(
        percentageDraft.map((share, index) => ({
          ...share,
          percentage: formatPercentageInput(getAllocationValue(percentages, index)),
        })),
      );
      setDraft(
        draft.map((share, index) => ({
          ...share,
          amount: getAllocationValue(amounts, index).toFixed(2),
        })),
      );
    } else {
      const amounts = rebalanceAmountShare(
        total,
        draft.map((share) => share.amount),
        targetIndex,
      );
      const nextDraft = draft.map((share, index) => ({
        ...share,
        amount: getAllocationValue(amounts, index).toFixed(2),
      }));
      setDraft(nextDraft);
      setPercentageDraft(createPercentageDraft(nextDraft, total));
    }

    setRedistributionSelection(null);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  const allocation = analyzeTransactionSplitAllocation({
    totalAmount: total,
    amounts: draft.map((share) => share.amount),
    percentages: percentageDraft.map((share) => parsePercentage(share.percentage)),
    mode: splitMode,
  });
  const {
    allocationExceeded,
    canSave,
    differenceCents,
    distributedPercentage,
    hasAllocationDifference,
    hasAllocationIssue,
    hasInvalidAllocation,
    percentageDifferenceBasisPoints,
  } = allocation;
  const disabledReason =
    people.length < 2
      ? "Cadastre outra pessoa para dividir o lançamento."
      : !primaryPersonId
        ? "Selecione a pessoa responsável pelo lançamento."
        : total <= 0
          ? "Informe o valor do lançamento antes de dividir."
          : null;
  const redistributionCandidates = draft.filter((share, index) => {
    if (share.personId === lastEditedPersonId) return false;
    if (allocation.differenceIsMissing) return true;
    return splitMode === "percentage"
      ? parsePercentage(percentageDraft[index]?.percentage ?? "") > 0.01
      : getAllocationValue(allocation.amountCents, index) > 1;
  });
  const showRedistribution =
    Boolean(lastEditedPersonId) &&
    draft.length >= 2 &&
    hasAllocationDifference &&
    !hasInvalidAllocation &&
    redistributionCandidates.length > 0;
  const selectedRedistributionPersonId = redistributionCandidates.some(
    (share) => share.personId === redistributionSelection,
  )
    ? redistributionSelection
    : (redistributionCandidates[0]?.personId ?? null);
  const selectedRedistributionPerson = people.find(
    (person) => person.id === selectedRedistributionPersonId,
  );

  return {
    open,
    setOpen,
    removalOpen,
    setRemovalOpen,
    draft,
    percentageDraft,
    splitMode,
    setRedistributionSelection,
    total,
    committedAllocation,
    isDivided,
    activeConnectedPersonIds,
    connectedShares,
    connectedDraftShares,
    cardDisabled,
    openEditor,
    togglePerson,
    updateAmount,
    updatePercentage,
    changeSplitMode,
    redistributeDifference,
    save,
    allocation,
    allocationExceeded,
    canSave,
    differenceCents,
    distributedPercentage,
    hasAllocationIssue,
    hasInvalidAllocation,
    percentageDifferenceBasisPoints,
    disabledReason,
    redistributionCandidates,
    showRedistribution,
    selectedRedistributionPersonId,
    selectedRedistributionPerson,
  };
}
