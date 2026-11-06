import {
  type AiDataScope,
  aiDiagnosisTransactionsLimit,
  createCategoryAliases,
} from "@openmonetis/domain/ai-data-sharing";
import type { FinancialHealth, FinancialHealthInput } from "@openmonetis/domain/ai-diagnoses";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { BudgetOutput } from "@openmonetis/validators/budgets";
import type { CardOutput } from "@openmonetis/validators/cards";
import type {
  DashboardAttentionOutput,
  DashboardSnapshotOutput,
} from "@openmonetis/validators/dashboard";
import type { GoalOutput } from "@openmonetis/validators/goals";
import type { TransactionOutput } from "@openmonetis/validators/transactions";

const promptCategoriesLimit = 10;

/**
 * How OpenMonetis assigns transactions to a month, which a model cannot guess from the dates: a
 * period is a competence month, and card purchases belong to the month of their invoice.
 */
export const aiPeriodInstructions = [
  "The data covers one period (YYYY-MM), a competence month, not a calendar range.",
  "Credit card purchases belong to the period of the invoice they are billed on, so a period's",
  "card transactions often have purchase dates (`date`) in earlier months. They are still part",
  "of that period: never say a period has no transactions just because their dates are earlier,",
  "and when a total seems to have no matching purchases, look for card purchases with earlier dates.",
];

export type AiSnapshotReader = {
  getSnapshot(period: string, userId: string): Promise<DashboardSnapshotOutput>;
  getAttention(period: string, userId: string): Promise<DashboardAttentionOutput>;
};

export type AiDataSharingReader = {
  scopesFor(userId: string): Promise<AiDataScope[]>;
};

/** Detailed records, read only when the person allowed the matching scope. */
export type AiDetailsReader = {
  listTransactions(userId: string, period: string): Promise<TransactionOutput[]>;
  listAccounts(userId: string, period: string): Promise<AccountOutput[]>;
  listCards(userId: string, period: string): Promise<CardOutput[]>;
  listBudgets(userId: string, period: string): Promise<BudgetOutput[]>;
  listGoals(userId: string): Promise<GoalOutput[]>;
};

export type FinancialSnapshot = {
  snapshot: DashboardSnapshotOutput;
  attention: DashboardAttentionOutput;
  healthInput: FinancialHealthInput;
};

type FinancialDetails = {
  transactions: TransactionOutput[] | null;
  accounts: AccountOutput[] | null;
  cards: CardOutput[] | null;
  budgets: BudgetOutput[] | null;
  goals: GoalOutput[] | null;
};

/**
 * The financial data an AI provider may see, shared by diagnoses and chats. Aggregates are always
 * described; detailed records follow the scopes the person allowed.
 */
export function createAiContextService(dependencies: {
  snapshots: AiSnapshotReader;
  details: AiDetailsReader;
}) {
  const { snapshots, details } = dependencies;

  async function readDetails(userId: string, period: string, scopes: AiDataScope[]) {
    const allowed = new Set(scopes);
    const [transactions, accounts, cards, budgets, goals] = await Promise.all([
      allowed.has("transactions") ? details.listTransactions(userId, period) : null,
      allowed.has("accounts") ? details.listAccounts(userId, period) : null,
      allowed.has("accounts") ? details.listCards(userId, period) : null,
      allowed.has("budgetsAndGoals") ? details.listBudgets(userId, period) : null,
      allowed.has("budgetsAndGoals") ? details.listGoals(userId) : null,
    ]);
    return { transactions, accounts, cards, budgets, goals } satisfies FinancialDetails;
  }

  return {
    async load(userId: string, period: string): Promise<FinancialSnapshot> {
      const [snapshot, attention] = await Promise.all([
        snapshots.getSnapshot(period, userId),
        snapshots.getAttention(period, userId),
      ]);
      return { snapshot, attention, healthInput: toFinancialHealthInput(snapshot, attention) };
    },

    /**
     * The data object sent to the provider, the aliases that hide category names when they may
     * not leave OpenMonetis, and the category ids the provider may reference.
     */
    async describe(input: {
      userId: string;
      period: string;
      health: FinancialHealth;
      scopes: AiDataScope[];
      loaded: FinancialSnapshot;
    }) {
      const categories = input.loaded.snapshot.categoryBreakdown.expenses
        .filter((category) => category.amount > 0)
        .slice(0, promptCategoriesLimit);
      const aliases = createCategoryAliases(input.scopes.includes("categoryNames"));
      const data = describeFinancialData(
        input,
        input.loaded,
        categories,
        await readDetails(input.userId, input.period, input.scopes),
        aliases,
      );
      return {
        data,
        aliases,
        categoryIds: new Set(categories.map((category) => category.categoryId)),
      };
    },
  };
}

export type AiContextService = ReturnType<typeof createAiContextService>;
export type AiFinancialContextReader = Pick<AiContextService, "load" | "describe">;

function toFinancialHealthInput(
  snapshot: DashboardSnapshotOutput,
  attention: DashboardAttentionOutput,
): FinancialHealthInput {
  return {
    history: snapshot.metrics.history.map(({ period, income, expenses }) => ({
      period,
      income,
      expenses,
    })),
    totalBalance: snapshot.accounts.totalBalance,
    expenseCategories: snapshot.categoryBreakdown.expenses.map((category) => ({
      categoryId: category.categoryId,
      categoryName: category.categoryName,
      amount: category.amount,
      previousAmount: category.previousAmount,
    })),
    attention: {
      critical: attention.items.filter((item) => item.severity === "critical").length,
      warning: attention.items.filter((item) => item.severity === "warning").length,
    },
  };
}

type CategoryAliases = ReturnType<typeof createCategoryAliases>;

/**
 * Aggregates always leave the API: indicators, monthly totals, top categories and counts of items
 * needing attention. Everything else depends on the scopes the person allowed; without
 * `categoryNames`, category names are replaced by placeholders restored after the answer.
 */
function describeFinancialData(
  input: { period: string; health: FinancialHealth; scopes: AiDataScope[] },
  context: FinancialSnapshot,
  categories: DashboardSnapshotOutput["categoryBreakdown"]["expenses"],
  details: FinancialDetails,
  aliases: CategoryAliases,
) {
  const { metrics, paymentStatus, expenseDistribution } = context.snapshot;
  const allowed = new Set(input.scopes);
  return {
    period: input.period,
    currency: "BRL",
    score: input.health.score,
    level: input.health.level,
    indicators: input.health.indicators,
    monthlyHistory: input.health.charts.incomeExpenseHistory,
    currentMonth: {
      income: metrics.income.current,
      expenses: metrics.expenses.current,
      balance: metrics.balance.current,
      projectedBalance: metrics.projected.current,
      pendingIncome: paymentStatus.income.pending,
      pendingExpenses: paymentStatus.expenses.pending,
    },
    totalAccountBalance: context.snapshot.accounts.totalBalance,
    expenseConditions: expenseDistribution.conditions.map(({ key, amount, percentage }) => ({
      condition: key,
      amount,
      percentage,
    })),
    paymentMethods: expenseDistribution.paymentMethods.map(({ key, amount, percentage }) => ({
      method: key,
      amount,
      percentage,
    })),
    categories: categories.map((category) => ({
      categoryId: category.categoryId,
      name: aliases.name(category.categoryId, category.categoryName),
      amount: category.amount,
      previousAmount: category.previousAmount,
      percentage: category.percentage,
    })),
    attentionItems: context.attention.items.map((item) => ({
      kind: item.kind,
      severity: item.severity,
      amount: item.amount,
      dueDate: item.dueDate,
      daysUntilDue: item.daysUntilDue,
      budgetStatus: item.budgetStatus,
      usagePercentage: item.usagePercentage,
    })),
    ...(details.transactions
      ? {
          transactions: describeTransactions(details.transactions, aliases, {
            people: allowed.has("people"),
            notes: allowed.has("notes"),
            accounts: allowed.has("accounts"),
          }),
        }
      : {}),
    ...(details.accounts
      ? {
          accounts: details.accounts
            .filter((account) => !account.isArchived)
            .map((account) => ({
              name: account.name,
              type: account.type,
              balance: account.summary.balance,
              income: account.summary.income,
              expenses: account.summary.expenses,
              excludedFromTotal: account.excludeFromBalance,
            })),
        }
      : {}),
    ...(details.cards
      ? {
          cards: details.cards.map((card) => ({
            name: card.name,
            status: card.status,
            limit: card.limit,
            invoiceAmount: card.invoiceSummary.amount,
            invoiceRemaining: card.invoiceSummary.remainingAmount,
            invoiceStatus: card.invoiceSummary.status,
            invoiceDueDate: card.invoiceSummary.dueDate,
          })),
        }
      : {}),
    ...(details.budgets
      ? {
          budgets: details.budgets.map((budget) => ({
            category: aliases.name(budget.categoryId, budget.categoryName),
            amount: budget.amount,
            spent: budget.actualSpentAmount,
            committed: budget.committedAmount,
            usagePercentage: budget.usagePercentage,
            status: budget.status,
          })),
        }
      : {}),
    ...(details.goals
      ? {
          goals: details.goals.map((goal) => ({
            name: goal.name,
            targetAmount: goal.targetAmount,
            currentAmount: goal.currentAmount,
            progressPercentage: goal.progressPercentage,
            targetDate: goal.targetDate,
            status: goal.status,
            pace: goal.paceStatus,
          })),
        }
      : {}),
  };
}

function describeTransactions(
  transactions: TransactionOutput[],
  aliases: CategoryAliases,
  reveal: { people: boolean; notes: boolean; accounts: boolean },
) {
  return [...transactions]
    .sort((left, right) => right.purchaseDate.localeCompare(left.purchaseDate))
    .slice(0, aiDiagnosisTransactionsLimit)
    .map((item) => ({
      date: item.purchaseDate,
      description: item.name,
      type: item.type,
      amount: item.amount,
      condition: item.condition,
      paymentMethod: item.paymentMethod,
      category: aliases.name(item.categoryId, item.categoryName),
      settled: item.isSettled,
      dueDate: item.dueDate,
      installment:
        item.currentInstallment && item.installmentCount
          ? `${item.currentInstallment}/${item.installmentCount}`
          : null,
      recurrence: item.recurrenceFrequency,
      ...(reveal.accounts ? { account: item.accountName, card: item.cardName } : {}),
      ...(reveal.people
        ? {
            person: item.personName,
            splitWith: item.splitShares.map((share) => ({
              person: share.personName,
              amount: share.amount,
            })),
          }
        : {}),
      ...(reveal.notes ? { note: item.note } : {}),
    }));
}
