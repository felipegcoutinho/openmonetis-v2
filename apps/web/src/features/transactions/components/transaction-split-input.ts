import { calculatePercentageShares, splitAmountEqually } from "@openmonetis/domain/transactions";
import type { PercentageFormShare, SplitFormShare } from "./transaction-split-dialog.types";
import { percentageFormatter } from "./transaction-split-dialog-options";

export function createEqualShares(personIds: string[], total: number): SplitFormShare[] {
  const amounts = splitAmountEqually(total, personIds.length);
  return personIds.map((personId, index) => ({
    personId,
    amount: getAllocationValue(amounts, index).toFixed(2),
  }));
}

export function parsePercentage(value: string) {
  const percentage = Number(value.replace(",", "."));
  return Number.isFinite(percentage) ? percentage : 0;
}

export function formatPercentageInput(value: number) {
  return percentageFormatter.format(value);
}

export function normalizePercentageInput(value: string) {
  const normalized = value.replace(".", ",").replace(/[^\d,]/g, "");
  const [integer = "", ...decimalParts] = normalized.split(",");
  if (!decimalParts.length) return integer;
  return `${integer},${decimalParts.join("").slice(0, 2)}`;
}

export function getAllocationValue(values: readonly number[], index: number) {
  const value = values[index];
  if (value === undefined) throw new Error("Incomplete split allocation");
  return value;
}

export function createPercentageDraft(
  shares: SplitFormShare[],
  total: number,
): PercentageFormShare[] {
  if (!shares.length || total <= 0) return [];
  const percentages = calculatePercentageShares(
    total,
    shares.map((share) => share.amount),
  );
  return shares.map((share, index) => ({
    personId: share.personId,
    percentage: formatPercentageInput(getAllocationValue(percentages, index)),
  }));
}
