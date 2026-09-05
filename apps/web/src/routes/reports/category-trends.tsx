import { createFileRoute } from "@tanstack/react-router";
import {
  resolveCategoryTrendsSearch,
  validateCategoryTrendsSearch,
} from "@/features/category-trends/category-trends.presentation";
import { CategoryTrendsPage } from "@/features/category-trends/components/category-trends-page";

export const Route = createFileRoute("/reports/category-trends")({
  component: CategoryTrendsRoute,
  validateSearch: validateCategoryTrendsSearch,
});

function CategoryTrendsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const filters = resolveCategoryTrendsSearch(search);

  return (
    <CategoryTrendsPage
      filters={filters}
      onFiltersChange={(nextFilters) =>
        navigate({
          replace: true,
          search: (previous) => ({
            ...previous,
            period: undefined,
            startPeriod: nextFilters.startPeriod,
            endPeriod: nextFilters.endPeriod,
            categoryIds: nextFilters.categoryIds.length
              ? nextFilters.categoryIds.join(",")
              : undefined,
          }),
        })
      }
    />
  );
}
