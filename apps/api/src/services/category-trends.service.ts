import {
  type CategoryTrendActualEntry,
  type CategoryTrendCategory,
  type CategoryTrendRecurringRule,
  calculateCategoryTrends,
} from "@openmonetis/domain/category-trends";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import type {
  CategoryTrendsOutput,
  ListCategoryTrendsQuery,
} from "@openmonetis/validators/category-trends";

export type CategoryTrendsRepository = {
  listCategoriesForUser(userId: string): Promise<CategoryTrendCategory[]>;
  listActualEntriesForUser(
    userId: string,
    startPeriod: string,
    endPeriod: string,
    categoryIds: readonly string[],
  ): Promise<CategoryTrendActualEntry[]>;
  listRecurringRulesForUser(
    userId: string,
    periodEnd: Date,
    categoryIds: readonly string[],
  ): Promise<CategoryTrendRecurringRule[]>;
};

export function createCategoryTrendsService(repository: CategoryTrendsRepository) {
  return {
    async list(userId: string, query: ListCategoryTrendsQuery): Promise<CategoryTrendsOutput> {
      const lookbackPeriod = addMonthsToPeriod(query.startPeriod, -1);
      const periodEnd = getPeriodEnd(query.endPeriod);
      const [categories, actualEntries, recurringRules] = await Promise.all([
        repository.listCategoriesForUser(userId),
        repository.listActualEntriesForUser(
          userId,
          lookbackPeriod,
          query.endPeriod,
          query.categoryIds,
        ),
        repository.listRecurringRulesForUser(userId, periodEnd, query.categoryIds),
      ]);

      return calculateCategoryTrends({
        startPeriod: query.startPeriod,
        endPeriod: query.endPeriod,
        categoryIds: query.categoryIds,
        categories,
        actualEntries,
        recurringRules,
      });
    },
  };
}

function getPeriodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

export type CategoryTrendsService = ReturnType<typeof createCategoryTrendsService>;
