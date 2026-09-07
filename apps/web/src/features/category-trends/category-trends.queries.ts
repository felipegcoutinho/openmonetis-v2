import type { ListCategoryTrendsQuery } from "@openmonetis/validators/category-trends";
import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { getCategoryTrends } from "./category-trends.api";

const categoryTrendsKeys = {
  all: ["category-trends"] as const,
  report: (query: ListCategoryTrendsQuery) =>
    [
      ...categoryTrendsKeys.all,
      query.startPeriod,
      query.endPeriod,
      [...query.categoryIds].sort().join(","),
      query.personScope ?? "admin",
    ] as const,
};

export function categoryTrendsQueryOptions(query: ListCategoryTrendsQuery) {
  return queryOptions({
    queryKey: categoryTrendsKeys.report(query),
    queryFn: () => getCategoryTrends(query),
    placeholderData: keepPreviousData,
  });
}
