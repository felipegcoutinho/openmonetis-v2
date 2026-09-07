import type {
  CategoryTrendsOutput,
  ListCategoryTrendsQuery,
} from "@openmonetis/validators/category-trends";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string): Promise<T> {
  return requestApi<T>(path, undefined, { useResponseMessage: true });
}

export function getCategoryTrends(query: ListCategoryTrendsQuery) {
  const params = new URLSearchParams({
    startPeriod: query.startPeriod,
    endPeriod: query.endPeriod,
  });
  if (query.categoryIds.length) params.set("categoryIds", query.categoryIds.join(","));
  if (query.personScope) params.set("personScope", query.personScope);

  return request<CategoryTrendsOutput>(`/reports/category-trends?${params.toString()}`);
}
