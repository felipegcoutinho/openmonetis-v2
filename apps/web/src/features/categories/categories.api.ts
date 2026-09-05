import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
} from "@openmonetis/validators/categories";
import { requestApi as request } from "@/lib/api-client";

export const getCategories = () => request<CategoryOutput[]>("/categories");
export const getCategory = (id: string) => request<CategoryOutput>(`/categories/${id}`);
export const createCategory = (input: CreateCategoryInput) =>
  request<CategoryOutput>("/categories", { method: "POST", body: JSON.stringify(input) });
export const replaceCategory = (id: string, input: ReplaceCategoryInput) =>
  request<CategoryOutput>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(input) });
export const deleteCategory = (id: string) =>
  request<{ id: string }>(`/categories/${id}`, { method: "DELETE" });
