import type { ReplaceCategoryInput } from "@openmonetis/validators/categories";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { createCategory, deleteCategory, replaceCategory } from "./categories.api";
export function useCreateCategoryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
export function useReplaceCategoryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReplaceCategoryInput }) =>
      replaceCategory(id, input),
    onSuccess: () => refreshFinancialQueries(client),
  });
}
export function useDeleteCategoryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
