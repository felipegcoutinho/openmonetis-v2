import type { CategoryOutput } from "@openmonetis/validators/categories";
export const categoryTypeLabels: Record<CategoryOutput["type"], string> = {
  income: "Receita",
  expense: "Despesa",
};
