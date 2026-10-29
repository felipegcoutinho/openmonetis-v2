import {
  calculateExpenseImpact,
  type TransactionOrigin,
  type TransactionType,
} from "./transactions";

export const maximumTransactionTags = 20;
export function normalizeTagName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}
export function getTagNameKey(name: string) {
  return normalizeTagName(name).toLocaleLowerCase("pt-BR");
}
export function matchesTransactionTags(
  tagIds: readonly string[],
  selected: readonly string[],
  withoutTags = false,
) {
  if (withoutTags) return tagIds.length === 0;
  return selected.length === 0 || selected.some((id) => tagIds.includes(id));
}
export function canAddTransactionTags(
  currentTagIds: readonly string[],
  addedTagIds: readonly string[],
) {
  return new Set([...currentTagIds, ...addedTagIds]).size <= maximumTransactionTags;
}
export type TaggedFinancialEntry = {
  id: string;
  tagIds?: string[];
  amount: number;
  type: TransactionType;
  origin: TransactionOrigin;
  allocation?: { amount: number } | null;
};
export function summarizeTags(tagIds: readonly string[], entries: readonly TaggedFinancialEntry[]) {
  const totals = new Map(tagIds.map((id) => [id, { income: 0, expenses: 0, transfers: 0 }]));
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    if (
      entry.origin === "invoicePayment" ||
      entry.origin === "accountBalanceAdjustment" ||
      entry.origin === "personSettlement"
    )
      continue;
    const amount = entry.allocation?.amount ?? entry.amount;
    // Transfers have two opposite postings with the same tags. Count only the outgoing one.
    const transferCents = entry.type === "transfer" ? Math.max(0, -Math.round(amount * 100)) : 0;
    const expenseCents = Math.round(calculateExpenseImpact({ ...entry, amount }) * 100);
    const incomeCents =
      entry.type === "income" && entry.origin === "regular"
        ? Math.round(Math.abs(amount) * 100)
        : 0;
    for (const id of new Set(entry.tagIds ?? [])) {
      const total = totals.get(id);
      if (total) {
        total.income += incomeCents;
        total.expenses += expenseCents;
        total.transfers += transferCents;
      }
    }
  }
  return [...totals].map(([tagId, total]) => ({
    tagId,
    income: total.income / 100,
    expenses: total.expenses / 100,
    transfers: total.transfers / 100,
    balance: (total.income - total.expenses) / 100,
  }));
}
