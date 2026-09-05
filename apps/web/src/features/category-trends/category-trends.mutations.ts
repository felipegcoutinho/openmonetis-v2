import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { useMutation } from "@tanstack/react-query";
import { downloadCategoryTrendsCsv } from "./category-trends.presentation";

export function useExportCategoryTrendsMutation() {
  return useMutation({
    mutationFn: async (report: CategoryTrendsOutput) => {
      downloadCategoryTrendsCsv(report);
      return { exportedCategoryCount: report.categories.length };
    },
  });
}
