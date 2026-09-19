import {
  type CategoryTrendActualEntry,
  type CategoryTrendCategory,
  type CategoryTrendRecurringRule,
  calculateCategoryTrends,
} from "@openmonetis/domain/category-trends";
import { addMonthsToPeriod, getPeriodEndDate } from "@openmonetis/domain/transactions";
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
    personScope?: string,
  ): Promise<CategoryTrendActualEntry[]>;
  listRecurringRulesForUser(
    userId: string,
    periodEnd: Date,
    categoryIds: readonly string[],
    personScope?: string,
  ): Promise<CategoryTrendRecurringRule[]>;
};

export function createCategoryTrendsService(repository: CategoryTrendsRepository) {
  return {
    async list(userId: string, query: ListCategoryTrendsQuery): Promise<CategoryTrendsOutput> {
      const lookbackPeriod = addMonthsToPeriod(query.startPeriod, -1);
      const periodEnd = getPeriodEndDate(query.endPeriod);
      const [categories, actualEntries, recurringRules] = await Promise.all([
        repository.listCategoriesForUser(userId),
        repository.listActualEntriesForUser(
          userId,
          lookbackPeriod,
          query.endPeriod,
          query.categoryIds,
          query.personScope ?? "admin",
        ),
        repository.listRecurringRulesForUser(
          userId,
          periodEnd,
          query.categoryIds,
          query.personScope ?? "admin",
        ),
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

export type CategoryTrendsService = ReturnType<typeof createCategoryTrendsService>;
