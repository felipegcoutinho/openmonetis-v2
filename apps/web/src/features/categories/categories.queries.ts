import { queryOptions } from "@tanstack/react-query";
import { getCategories, getCategory } from "./categories.api";

const categoryKeys = {
  all: ["categories"] as const,
  detail: (id: string) => ["categories", id] as const,
};
export const categoriesQueryOptions = () =>
  queryOptions({ queryKey: categoryKeys.all, queryFn: getCategories });
export const categoryQueryOptions = (id: string) =>
  queryOptions({ queryKey: categoryKeys.detail(id), queryFn: () => getCategory(id) });
