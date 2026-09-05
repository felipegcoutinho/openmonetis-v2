import { cards, db, financialAccounts, userPreferences } from "@openmonetis/db";
import { and, eq } from "drizzle-orm";
import type { PreferencesRepository } from "../services/preferences.service";

export const preferencesRepository = {
  async findByUserId(userId) {
    const [preferences] = await db
      .select({
        theme: userPreferences.theme,
        hideValuesOnStart: userPreferences.hideValuesOnStart,
        defaultPaymentMethod: userPreferences.defaultPaymentMethod,
        defaultAccountId: financialAccounts.id,
        defaultCardId: cards.id,
        notificationDueSoonDays: userPreferences.notificationDueSoonDays,
        transactionsPageSize: userPreferences.transactionsPageSize,
      })
      .from(userPreferences)
      .leftJoin(
        financialAccounts,
        and(
          eq(userPreferences.defaultAccountId, financialAccounts.id),
          eq(financialAccounts.userId, userId),
          eq(financialAccounts.isArchived, false),
        ),
      )
      .leftJoin(
        cards,
        and(
          eq(userPreferences.defaultCardId, cards.id),
          eq(cards.userId, userId),
          eq(cards.status, "active"),
        ),
      )
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    return preferences ?? null;
  },

  async isActiveAccountForUser(accountId, userId) {
    const [account] = await db
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.id, accountId),
          eq(financialAccounts.userId, userId),
          eq(financialAccounts.isArchived, false),
        ),
      )
      .limit(1);
    return Boolean(account);
  },

  async isActiveCardForUser(cardId, userId) {
    const [card] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.id, cardId), eq(cards.userId, userId), eq(cards.status, "active")))
      .limit(1);
    return Boolean(card);
  },

  async saveForUser(userId, preferences) {
    await db
      .insert(userPreferences)
      .values({ userId, ...preferences })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...preferences, updatedAt: new Date() },
      });
  },

  async deleteForUser(userId) {
    await db.delete(userPreferences).where(eq(userPreferences.userId, userId));
  },
} satisfies PreferencesRepository;
