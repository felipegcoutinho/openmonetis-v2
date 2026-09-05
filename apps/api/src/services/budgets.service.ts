import {
  type BudgetCreateDraft,
  type BudgetRecurringRule,
  type BudgetSpendingEntry,
  calculateBudgetOverview,
  type calculateBudgetProgress,
  calculateBudgetSpending,
  createBudgetDraft,
  getPreviousBudgetPeriod,
} from "@openmonetis/domain/budgets";
import type {
  BudgetOutput,
  CopyPreviousBudgetsInput,
  CreateBudgetInput,
  ListBudgetsQuery,
  UpdateBudgetInput,
} from "@openmonetis/validators/budgets";
import { badRequest, notFound } from "../utils/errors";

type BudgetRecord = {
  id: string;
  userId: string;
  categoryId: string;
  period: string;
  amount: string;
  createdAt: Date;
  updatedAt: Date;
};

export type BudgetWithCategoryRecord = BudgetRecord & {
  categoryName: string;
  categoryIcon: string | null;
};

type BudgetUpdateRecord = { amount?: string; period?: string };

export type BudgetsRepository = {
  insertIfAbsent(data: BudgetCreateDraft): Promise<BudgetRecord | null>;
  listByUserAndPeriod(userId: string, period: string): Promise<BudgetWithCategoryRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<BudgetWithCategoryRecord | null>;
  findByCategoryAndPeriodForUser(
    categoryId: string,
    period: string,
    userId: string,
  ): Promise<BudgetRecord | null>;
  updateForUser(id: string, userId: string, data: BudgetUpdateRecord): Promise<BudgetRecord | null>;
  deleteForUser(id: string, userId: string): Promise<BudgetRecord | null>;
  listSpendingEntries(userId: string, period: string): Promise<BudgetSpendingEntry[]>;
  listRecurringRules(userId: string, periodEnd: Date): Promise<BudgetRecurringRule[]>;
  insertCopies(data: BudgetCreateDraft[]): Promise<BudgetRecord[]>;
};

type BudgetCategoriesRepository = {
  findByIdForUser(
    id: string,
    userId: string,
  ): Promise<{ id: string; type: "income" | "expense" } | null>;
};

export function createBudgetsService(
  repository: BudgetsRepository,
  categoriesRepository: BudgetCategoriesRepository,
) {
  async function expenseCategory(categoryId: string, userId: string) {
    const category = await categoriesRepository.findByIdForUser(categoryId, userId);
    if (category?.type !== "expense") {
      throw notFound("Expense category not found", "expense_category_not_found");
    }
    return category;
  }

  async function list(userId: string, query: ListBudgetsQuery) {
    const periodEnd = getPeriodEnd(query.period);
    const [budgetRows, spendingEntries, recurringRules] = await Promise.all([
      repository.listByUserAndPeriod(userId, query.period),
      repository.listSpendingEntries(userId, query.period),
      repository.listRecurringRules(userId, periodEnd),
    ]);
    const spending = calculateBudgetSpending(spendingEntries, recurringRules, query.period);
    const overview = calculateBudgetOverview(budgetRows, spending);
    const items = budgetRows
      .map((budget) =>
        toOutput(
          budget,
          overview.progressByCategory.get(budget.categoryId) as ReturnType<
            typeof calculateBudgetProgress
          >,
        ),
      )
      .sort((left, right) => left.categoryName.localeCompare(right.categoryName, "pt-BR"));

    return {
      period: query.period,
      allocatedAmount: overview.allocatedAmount,
      actualSpentAmount: overview.actualSpentAmount,
      projectedAmount: overview.projectedAmount,
      committedAmount: overview.committedAmount,
      availableAmount: overview.availableAmount,
      exceededAmount: overview.exceededAmount,
      unbudgetedCommittedAmount: overview.unbudgetedCommittedAmount,
      warningCount: overview.warningCount,
      items,
    };
  }

  return {
    list,

    async get(id: string, userId: string) {
      const budget = await repository.findByIdForUser(id, userId);
      if (!budget) throw notFound("Budget not found", "budget_not_found");
      const overview = await list(userId, { period: budget.period });
      const output = overview.items.find((item) => item.id === id);
      if (!output) throw notFound("Budget not found", "budget_not_found");
      return output;
    },

    async create(input: CreateBudgetInput, userId: string) {
      await expenseCategory(input.categoryId, userId);
      const budget = await repository.insertIfAbsent(
        createBudgetDraft({
          userId,
          categoryId: input.categoryId,
          period: input.period,
          amount: input.amount,
        }),
      );
      if (!budget) {
        throw badRequest(
          "A budget already exists for this category and period",
          "budget_already_exists",
        );
      }
      const output = (await list(userId, { period: input.period })).items.find(
        (item) => item.id === budget.id,
      );
      if (!output) throw notFound("Budget not found", "budget_not_found");
      return output;
    },

    async update(id: string, userId: string, input: UpdateBudgetInput) {
      const current = await repository.findByIdForUser(id, userId);
      if (!current) throw notFound("Budget not found", "budget_not_found");
      const targetPeriod = input.period ?? current.period;
      if (targetPeriod !== current.period) {
        const existing = await repository.findByCategoryAndPeriodForUser(
          current.categoryId,
          targetPeriod,
          userId,
        );
        if (existing) {
          throw badRequest(
            "A budget already exists for this category and period",
            "budget_already_exists",
          );
        }
      }
      const values: BudgetUpdateRecord = {};
      if (input.amount !== undefined) values.amount = input.amount.toFixed(2);
      if (input.period !== undefined) values.period = input.period;
      const budget = await repository.updateForUser(id, userId, values);
      if (!budget) throw notFound("Budget not found", "budget_not_found");
      const output = (await list(userId, { period: targetPeriod })).items.find(
        (item) => item.id === id,
      );
      if (!output) throw notFound("Budget not found", "budget_not_found");
      return output;
    },

    async remove(id: string, userId: string) {
      const budget = await repository.deleteForUser(id, userId);
      if (!budget) throw notFound("Budget not found", "budget_not_found");
      return { id: budget.id };
    },

    async copyPrevious(input: CopyPreviousBudgetsInput, userId: string) {
      const previousBudgets = await repository.listByUserAndPeriod(
        userId,
        getPreviousBudgetPeriod(input.period),
      );
      const selectedIds = new Set(input.sourceBudgetIds);
      const selectedBudgets = previousBudgets.filter((budget) => selectedIds.has(budget.id));
      if (selectedBudgets.length !== selectedIds.size) {
        throw badRequest("One or more source budgets are invalid", "invalid_source_budgets");
      }
      const drafts = selectedBudgets.map((budget) => ({
        userId,
        categoryId: budget.categoryId,
        period: input.period,
        amount: budget.amount,
      }));

      const createdCount = (await repository.insertCopies(drafts)).length;
      return { createdCount, skippedCount: selectedBudgets.length - createdCount };
    },
  };
}

function toOutput(
  budget: BudgetWithCategoryRecord,
  progress: ReturnType<typeof calculateBudgetProgress>,
): BudgetOutput {
  return {
    id: budget.id,
    categoryId: budget.categoryId,
    categoryName: budget.categoryName,
    categoryIcon: budget.categoryIcon,
    period: budget.period,
    amount: Math.abs(Number(budget.amount)),
    ...progress,
    createdAt: budget.createdAt.toISOString(),
    updatedAt: budget.updatedAt.toISOString(),
  };
}

function getPeriodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

export type BudgetsService = ReturnType<typeof createBudgetsService>;
