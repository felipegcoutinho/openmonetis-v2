import {
  assertBudgetRuleFits,
  type BudgetCreateDraft,
  type BudgetRecurringRule,
  type BudgetRuleChange,
  BudgetRuleError,
  type BudgetSpendingEntry,
  calculateBudgetOverview,
  type calculateBudgetProgress,
  calculateBudgetSpending,
  createBudgetDraft,
  createBudgetRuleDraft,
  getPreviousBudgetPeriod,
  isBudgetRuleActiveInPeriod,
  planBudgetRuleAmountChange,
  planBudgetRuleStop,
  type ResolvedBudgetLimit,
  resolveBudgetLimits,
} from "@openmonetis/domain/budgets";
import { getPeriodEndDate } from "@openmonetis/domain/transactions";
import type {
  BudgetOutput,
  CopyPreviousBudgetsInput,
  CreateBudgetInput,
  ListBudgetsQuery,
  StopBudgetRuleInput,
  StoppedBudgetRuleOutput,
  UpdateBudgetInput,
  UpdateBudgetRuleInput,
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

type BudgetWithCategoryRecord = BudgetRecord & {
  categoryName: string;
  categoryIcon: string | null;
};

type BudgetUpdateRecord = { amount?: string; period?: string };

type BudgetRuleRecord = {
  id: string;
  userId: string;
  categoryId: string;
  amount: string;
  startPeriod: string;
  endPeriod: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type BudgetRuleWithCategoryRecord = BudgetRuleRecord & {
  categoryName: string;
  categoryIcon: string | null;
};

/** Reads and writes of one category's recurring budget, while its row is locked. */
export type BudgetRuleStore = {
  listRules(): Promise<BudgetRuleRecord[]>;
  findMonthlyBudget(period: string): Promise<BudgetRecord | null>;
  /** Applies every part of `change` (and the optional monthly removal) atomically. */
  apply(change: BudgetRuleChange & { deleteMonthlyBudgetId?: string }): Promise<void>;
};

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
  listRulesForPeriod(userId: string, period: string): Promise<BudgetRuleWithCategoryRecord[]>;
  findRuleForUser(id: string, userId: string): Promise<BudgetRuleRecord | null>;
  /**
   * Runs `work` in one transaction holding a lock on the category row, so overlap checks and
   * writes of the same category's rules never interleave.
   */
  withCategoryLock<T>(
    userId: string,
    categoryId: string,
    work: (store: BudgetRuleStore) => Promise<T>,
  ): Promise<T>;
};

function translateRuleError(error: unknown): never {
  if (error instanceof BudgetRuleError) {
    if (error.code === "budget_already_exists") {
      throw badRequest(
        "A budget already exists for this category and period",
        "budget_already_exists",
      );
    }
    if (error.code === "budget_rule_overlap") {
      throw badRequest(
        "A recurring budget already covers this category in this period",
        "budget_rule_overlap",
      );
    }
    throw badRequest("The period is outside the recurring budget", "budget_rule_period_outside");
  }
  throw error;
}

async function withRuleErrors<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    translateRuleError(error);
  }
}

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
    const periodEnd = getPeriodEndDate(query.period);
    const [budgetRows, budgetRules, spendingEntries, recurringRules] = await Promise.all([
      repository.listByUserAndPeriod(userId, query.period),
      repository.listRulesForPeriod(userId, query.period),
      repository.listSpendingEntries(userId, query.period),
      repository.listRecurringRules(userId, periodEnd),
    ]);
    const limits = resolveBudgetLimits(query.period, budgetRules, budgetRows);
    const spending = calculateBudgetSpending(spendingEntries, recurringRules, query.period);
    const overview = calculateBudgetOverview(limits, spending);
    const items = limits
      .map((limit) =>
        toOutput(
          limit,
          query.period,
          overview.progressByCategory.get(limit.categoryId) as ReturnType<
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
      usagePercentage: overview.usagePercentage,
      unbudgetedCommittedAmount: overview.unbudgetedCommittedAmount,
      unbudgetedItems: overview.unbudgetedItems,
      warningCount: overview.warningCount,
      items,
    };
  }

  async function itemForCategory(userId: string, categoryId: string, period: string) {
    const output = (await list(userId, { period })).items.find(
      (item) => item.categoryId === categoryId,
    );
    if (!output) throw notFound("Budget not found", "budget_not_found");
    return output;
  }

  async function ruleForUser(ruleId: string, userId: string) {
    const rule = await repository.findRuleForUser(ruleId, userId);
    if (!rule) throw notFound("Recurring budget not found", "budget_rule_not_found");
    return rule;
  }

  /** Re-reads the rule inside the lock, so the plan is built on the latest stored versions. */
  async function lockedRule(store: BudgetRuleStore, ruleId: string) {
    const rules = await store.listRules();
    const rule = rules.find((candidate) => candidate.id === ruleId);
    if (!rule) throw notFound("Recurring budget not found", "budget_rule_not_found");
    return { rule, rules };
  }

  async function createRecurring(input: CreateBudgetInput, userId: string) {
    await withRuleErrors(() =>
      repository.withCategoryLock(userId, input.categoryId, async (store) => {
        if (await store.findMonthlyBudget(input.period)) {
          throw new BudgetRuleError("budget_already_exists");
        }
        const draft = createBudgetRuleDraft({
          userId,
          categoryId: input.categoryId,
          amount: input.amount,
          startPeriod: input.period,
        });
        assertBudgetRuleFits(draft, await store.listRules());
        await store.apply({ insertRule: draft });
      }),
    );
    return itemForCategory(userId, input.categoryId, input.period);
  }

  return {
    list,

    /** Turns a one-off monthly budget into a recurring one starting in its month. */
    async repeat(id: string, userId: string) {
      const budget = await repository.findByIdForUser(id, userId);
      if (!budget) throw notFound("Budget not found", "budget_not_found");
      await withRuleErrors(() =>
        repository.withCategoryLock(userId, budget.categoryId, async (store) => {
          const draft = createBudgetRuleDraft({
            userId,
            categoryId: budget.categoryId,
            amount: budget.amount,
            startPeriod: budget.period,
          });
          assertBudgetRuleFits(draft, await store.listRules());
          await store.apply({ insertRule: draft, deleteMonthlyBudgetId: budget.id });
        }),
      );
      return itemForCategory(userId, budget.categoryId, budget.period);
    },

    async updateRule(ruleId: string, userId: string, input: UpdateBudgetRuleInput) {
      const stored = await ruleForUser(ruleId, userId);
      await withRuleErrors(() =>
        repository.withCategoryLock(userId, stored.categoryId, async (store) => {
          const { rule, rules } = await lockedRule(store, ruleId);
          const change = planBudgetRuleAmountChange({
            userId,
            rule,
            period: input.period,
            scope: input.scope,
            amount: input.amount,
          });
          if (change.insertRule) assertBudgetRuleFits(change.insertRule, rules, [rule.id]);
          await store.apply(change);
        }),
      );
      return itemForCategory(userId, stored.categoryId, input.period);
    },

    async stopRule(
      ruleId: string,
      userId: string,
      input: StopBudgetRuleInput,
    ): Promise<StoppedBudgetRuleOutput> {
      const stored = await ruleForUser(ruleId, userId);
      const change = await withRuleErrors(() =>
        repository.withCategoryLock(userId, stored.categoryId, async (store) => {
          const { rule } = await lockedRule(store, ruleId);
          const plan = planBudgetRuleStop(rule, input.period);
          await store.apply(plan);
          return plan;
        }),
      );
      return {
        id: ruleId,
        endPeriod: change.updateRule?.endPeriod ?? null,
        deleted: change.deleteRuleId === ruleId,
      };
    },

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
      if (input.repeatMonthly) return createRecurring(input, userId);
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
      if (input.repeatMonthly) {
        let createdCount = 0;
        for (const budget of selectedBudgets) {
          const created = await repository.withCategoryLock(
            userId,
            budget.categoryId,
            async (store) => {
              // A category already limited in the month, by its own budget or a rule, is skipped.
              const rules = await store.listRules();
              if (await store.findMonthlyBudget(input.period)) return false;
              const draft = createBudgetRuleDraft({
                userId,
                categoryId: budget.categoryId,
                amount: budget.amount,
                startPeriod: input.period,
              });
              try {
                assertBudgetRuleFits(draft, rules);
              } catch (error) {
                if (error instanceof BudgetRuleError) return false;
                throw error;
              }
              await store.apply({ insertRule: draft });
              return true;
            },
          );
          if (created) createdCount++;
        }
        return { createdCount, skippedCount: selectedBudgets.length - createdCount };
      }

      const coveredCategoryIds = new Set(
        (await repository.listRulesForPeriod(userId, input.period))
          .filter((rule) => isBudgetRuleActiveInPeriod(rule, input.period))
          .map((rule) => rule.categoryId),
      );
      const drafts = selectedBudgets
        .filter((budget) => !coveredCategoryIds.has(budget.categoryId))
        .map((budget) => ({
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
  limit: ResolvedBudgetLimit<BudgetWithCategoryRecord, BudgetRuleWithCategoryRecord>,
  period: string,
  progress: ReturnType<typeof calculateBudgetProgress>,
): BudgetOutput {
  const { budget, rule } = limit;
  const source = (budget ?? rule) as BudgetWithCategoryRecord | BudgetRuleWithCategoryRecord;
  return {
    id: budget?.id ?? `${rule?.id}:${period}`,
    budgetId: budget?.id ?? null,
    recurrence: rule
      ? { ruleId: rule.id, startPeriod: rule.startPeriod, endPeriod: rule.endPeriod }
      : null,
    categoryId: limit.categoryId,
    categoryName: source.categoryName,
    categoryIcon: source.categoryIcon,
    period,
    amount: limit.amount,
    ...progress,
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export type BudgetsService = ReturnType<typeof createBudgetsService>;
