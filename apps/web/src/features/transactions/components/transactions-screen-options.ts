import type { TransactionCreateType } from "./transactions-screen.types";

export const createTransactionLabels: Record<TransactionCreateType, string> = {
  income: "Nova receita",
  expense: "Nova despesa",
  transfer: "Nova transferência",
};

export const defaultCreateTypes: readonly TransactionCreateType[] = [
  "income",
  "expense",
  "transfer",
];

export const transactionSortLabels = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  dueDate: "Vencimento",
  amount: "Maior valor",
} as const;
