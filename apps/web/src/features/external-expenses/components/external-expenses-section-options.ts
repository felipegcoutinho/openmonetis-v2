import type { ExternalExpenseSort } from "./external-expenses-section.types";

export const externalExpenseSortLabels: Record<ExternalExpenseSort, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  amountDesc: "Maior valor",
  amountAsc: "Menor valor",
  name: "Estabelecimento (A–Z)",
};
