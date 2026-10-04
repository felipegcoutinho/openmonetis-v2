import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";

import type { CategoryOutput } from "@openmonetis/validators/categories";

import type { Dispatch, SetStateAction } from "react";
import type { PreviewRow, ReviewRow } from "./transaction-import-screen.types";

export function getCommonRowValue(rows: ReviewRow[], selectValue: (row: ReviewRow) => string) {
  const firstValue = rows[0] ? selectValue(rows[0]) : "";
  return firstValue && rows.every((row) => selectValue(row) === firstValue) ? firstValue : "";
}

export function haveDifferentRowValues(rows: ReviewRow[], selectValue: (row: ReviewRow) => string) {
  return new Set(rows.map(selectValue)).size > 1;
}

export function updateRow(
  setRows: Dispatch<SetStateAction<ReviewRow[]>>,
  index: number,
  update: Partial<ReviewRow>,
) {
  setRows((current) =>
    current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...update } : row)),
  );
}

export function findCategoryByImportedName(categories: CategoryOutput[], transaction: PreviewRow) {
  if (transaction.suggestedCategoryId) return transaction.suggestedCategoryId;
  if (!transaction.categoryName) return "";
  const normalized = normalizeText(transaction.categoryName);
  return (
    categories.find(
      (category) =>
        category.type === transaction.type && normalizeText(category.name) === normalized,
    )?.id ?? ""
  );
}

export function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function currentPeriod() {
  return getCurrentPeriodInBrazil();
}
