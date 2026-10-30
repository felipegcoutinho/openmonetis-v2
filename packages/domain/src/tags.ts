import {
  calculateExpenseImpact,
  type TransactionOrigin,
  type TransactionType,
} from "./transactions";

export const maximumTransactionTags = 20;
/** Inactive tags keep their assignments and history but are no longer offered for new ones. */
export const tagStatuses = ["active", "inactive"] as const;
export type TagStatus = (typeof tagStatuses)[number];
/** Fixed palette names; each client maps them to its own theme tokens. */
export const tagColors = ["neutral", "orange", "blue", "green", "purple", "yellow", "red"] as const;
export type TagColor = (typeof tagColors)[number];
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
  const totals = new Map(
    tagIds.map((id) => [id, { income: 0, expenses: 0, transfers: 0, transactionCount: 0 }]),
  );
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
    // A transfer is one movement with two postings: only the outgoing one counts.
    const countsAsTransaction = entry.type !== "transfer" || amount < 0;
    for (const id of new Set(entry.tagIds ?? [])) {
      const total = totals.get(id);
      if (total) {
        total.income += incomeCents;
        total.expenses += expenseCents;
        total.transfers += transferCents;
        if (countsAsTransaction) total.transactionCount += 1;
      }
    }
  }
  return [...totals].map(([tagId, total]) => ({
    tagId,
    income: total.income / 100,
    expenses: total.expenses / 100,
    transfers: total.transfers / 100,
    balance: (total.income - total.expenses) / 100,
    transactionCount: total.transactionCount,
  }));
}
