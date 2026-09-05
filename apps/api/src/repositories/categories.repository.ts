import { budgets, categories, db, recurringTransactionRules, transactions } from "@openmonetis/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { CategoriesRepository } from "../services/categories.service";

export const categoriesRepository = {
  async insertDefaults(data) {
    await db.insert(categories).values(data).onConflictDoNothing();
  },
  async insert(data) {
    const [category] = await db.insert(categories).values(data).returning();
    return category;
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
    const [category] = await db
      .update(categories)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)),
      )
      .returning();
    return category ?? null;
  },
  async deleteForUser(id, userId) {
    const [category] = await db
      .delete(categories)
      .where(
        and(eq(categories.id, id), eq(categories.userId, userId), eq(categories.isSystem, false)),
      )
      .returning();
    return category ?? null;
  },
  async hasFinancialReferencesForUser(id, userId) {
    const [budgetRows, transactionRows, recurringRows] = await Promise.all([
      db
        .select({ id: budgets.id })
        .from(budgets)
        .where(and(eq(budgets.categoryId, id), eq(budgets.userId, userId)))
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
    return budgetRows.length > 0 || transactionRows.length > 0 || recurringRows.length > 0;
  },
} satisfies CategoriesRepository;

export const findCategoryByIdForUser = (id: string, userId: string) =>
  categoriesRepository.findByIdForUser(id, userId);
export const findSystemCategoryByNameForUser = (name: string, userId: string) =>
  categoriesRepository.findSystemByNameForUser(name, userId);

export function listCategoriesByIdsForUser(ids: string[], userId: string) {
  if (!ids.length) return [];
  return db
    .select({ id: categories.id, name: categories.name, type: categories.type })
    .from(categories)
    .where(and(eq(categories.userId, userId), inArray(categories.id, ids)));
}
