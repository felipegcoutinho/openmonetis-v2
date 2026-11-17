import {
  budgetRules,
  budgets,
  categories,
  db,
  recurringTransactionRules,
  transactions,
} from "@openmonetis/db";
import { CategoryConstraintError, expandCategoryIds } from "@openmonetis/domain/categories";
import { and, asc, eq, inArray, type SQLWrapper, sql } from "drizzle-orm";
import type { CategoriesRepository } from "../services/categories.service";

export const categoriesRepository = {
  async insertDefaults(data) {
    await db.insert(categories).values(data).onConflictDoNothing();
  },
  async insert(data) {
    return categoryWrite(data.userId, async (tx) => {
      const [category] = await tx.insert(categories).values(data).returning();
      return category;
    });
  },
  listByUser(userId) {
    return db
      .select()
      .from(categories)
      .where(eq(categories.userId, userId))
      .orderBy(asc(categories.name));
  },
  async findByIdForUser(id, userId) {
    const [category] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    return category ?? null;
  },
  async findSystemByNameForUser(name, userId) {
    const [category] = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.name, name),
          eq(categories.userId, userId),
          eq(categories.isSystem, true),
        ),
      )
      .limit(1);
    return category ?? null;
  },
  async updateForUser(id, userId, data) {
    return categoryWrite(userId, async (tx) => {
      const [category] = await tx
        .update(categories)
        .set({ ...data, updatedAt: new Date() })
        .where(
          and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)),
        )
        .returning();
      return category ?? null;
    });
  },
  async deleteForUser(id, userId) {
    return categoryWrite(userId, async (tx) => {
      const [category] = await tx
        .delete(categories)
        .where(
          and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)),
        )
        .returning();
      return category ?? null;
    });
  },
  async hasFinancialReferencesForUser(id, userId) {
    const [budgetRows, budgetRuleRows, transactionRows, recurringRows] = await Promise.all([
      db
        .select({ id: budgets.id })
        .from(budgets)
        .where(and(eq(budgets.categoryId, id), eq(budgets.userId, userId)))
        .limit(1),
      db
        .select({ id: budgetRules.id })
        .from(budgetRules)
        .where(and(eq(budgetRules.categoryId, id), eq(budgetRules.userId, userId)))
        .limit(1),
      db
        .select({ id: transactions.id })
        .from(transactions)
        .where(and(eq(transactions.categoryId, id), eq(transactions.userId, userId)))
        .limit(1),
      db
        .select({ id: recurringTransactionRules.id })
        .from(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.categoryId, id),
            eq(recurringTransactionRules.userId, userId),
          ),
        )
        .limit(1),
    ]);
    return (
      budgetRows.length > 0 ||
      budgetRuleRows.length > 0 ||
      transactionRows.length > 0 ||
      recurringRows.length > 0
    );
  },
} satisfies CategoriesRepository;

export const findCategoryByIdForUser = (id: string, userId: string) =>
  categoriesRepository.findByIdForUser(id, userId);
export const findSystemCategoryByNameForUser = (name: string, userId: string) =>
  categoriesRepository.findSystemByNameForUser(name, userId);

export function listCategoriesByIdsForUser(ids: string[], userId: string) {
  if (!ids.length) return [];
  return db
    .select({
      id: categories.id,
      name: categories.name,
      type: categories.type,
      isSystem: categories.isSystem,
    })
    .from(categories)
    .where(and(eq(categories.userId, userId), inArray(categories.id, ids)));
}

type CategoryTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function categoryWrite<T>(
  userId: string,
  operation: (tx: CategoryTransaction) => Promise<T>,
) {
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 0))`);
      return operation(tx);
    });
  } catch (error) {
    const wrapped = error as {
      code?: string;
      constraint?: string;
      cause?: { code?: string; constraint?: string };
    };
    const cause = wrapped.cause ?? wrapped;
    if (cause.code === "23505") throw new CategoryConstraintError("category_name_conflict");
    if (cause.code === "23514" && cause.constraint?.startsWith("categories_")) {
      throw new CategoryConstraintError(
        cause.constraint === "categories_children_check"
          ? "category_has_children"
          : "category_invalid_parent",
      );
    }
    if (cause.code === "23503") throw new CategoryConstraintError("category_in_use");
    throw error;
  }
}

export async function listCategoryFamilyIdsForUser(ids: string[], userId: string) {
  if (!ids.length) return ids;
  const rows = await db
    .select({ id: categories.id, parentId: categories.parentId })
    .from(categories)
    .where(eq(categories.userId, userId));
  return expandCategoryIds(rows, ids);
}

// The correlated lookup preserves one row per transaction and always scopes the parent to its owner.
export function categoryLabelSql(category: {
  name: SQLWrapper;
  parentId: SQLWrapper;
  userId: SQLWrapper;
}) {
  return sql<string>`case when ${category.parentId} is null then ${category.name}
    else concat((select p.name from categories p where p.id = ${category.parentId} and p.user_id = ${category.userId}), ' › ', ${category.name}) end`;
}
