import {
  cards,
  categories,
  db,
  financialAccounts,
  people,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionSplits,
} from "@openmonetis/db";
import { and, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { RecurringExpensesRepository } from "../services/recurring-expenses.service";

export const recurringExpensesRepository = {
  async listForPeriod(userId, periodStart, periodEnd) {
    return db
      .select({
        id: recurringTransactionRules.id,
        userId: recurringTransactionRules.userId,
        seriesId: recurringTransactionRules.seriesId,
        anchorDate: recurringTransactionRules.anchorDate,
        personId: recurringTransactionRules.personId,
        type: recurringTransactionRules.type,
        paymentMethod: recurringTransactionRules.paymentMethod,
        name: recurringTransactionRules.name,
        amount: recurringTransactionRules.amount,
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        frequency: recurringTransactionRules.frequency,
        accountId: recurringTransactionRules.accountId,
        cardId: recurringTransactionRules.cardId,
        categoryId: recurringTransactionRules.categoryId,
        sourceAccountId: recurringTransactionRules.sourceAccountId,
        destinationAccountId: recurringTransactionRules.destinationAccountId,
        dueDate: recurringTransactionRules.dueDate,
        isSettled: recurringTransactionRules.isSettled,
        note: recurringTransactionRules.note,
        status: recurringTransactionRules.status,
        personName: people.name,
        personAvatarUrl: people.avatarUrl,
        personRole: people.role,
        accountName: financialAccounts.name,
        accountLogo: financialAccounts.logo,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        cardName: cards.name,
        cardLogo: cards.logo,
        cardClosingDay: cards.closingDay,
        cardClosingRuleType: cards.closingRuleType,
        cardClosingOffsetDays: cards.closingOffsetDays,
        cardClosingOffsetMode: cards.closingOffsetMode,
        cardDueDay: cards.dueDay,
        hasSplits: sql<boolean>`exists (
          select 1 from ${recurringTransactionSplits}
          where ${recurringTransactionSplits.userId} = ${userId}
            and ${recurringTransactionSplits.recurringRuleId} = ${recurringTransactionRules.id}
        )`.as("has_splits"),
        adminAmount: sql<string | null>`case
          when exists (
            select 1 from ${recurringTransactionSplits}
            where ${recurringTransactionSplits.userId} = ${userId}
              and ${recurringTransactionSplits.recurringRuleId} = ${recurringTransactionRules.id}
          ) then (
            select ${recurringTransactionSplits.amount}
            from ${recurringTransactionSplits}
            inner join ${people}
              on ${people.id} = ${recurringTransactionSplits.personId}
              and ${people.userId} = ${userId}
              and ${people.role} = 'admin'
            where ${recurringTransactionSplits.userId} = ${userId}
              and ${recurringTransactionSplits.recurringRuleId} = ${recurringTransactionRules.id}
            limit 1
          )
          when ${people.role} = 'admin' then ${recurringTransactionRules.amount}
          else null
        end`.as("admin_amount"),
      })
      .from(recurringTransactionRules)
      .innerJoin(
        people,
        and(eq(recurringTransactionRules.personId, people.id), eq(people.userId, userId)),
      )
      .leftJoin(
        financialAccounts,
        and(
          eq(recurringTransactionRules.accountId, financialAccounts.id),
          eq(financialAccounts.userId, userId),
        ),
      )
      .leftJoin(
        categories,
        and(eq(recurringTransactionRules.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .leftJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          eq(recurringTransactionRules.type, "expense"),
          inArray(recurringTransactionRules.status, ["active", "paused"]),
          lte(recurringTransactionRules.startDate, periodEnd),
          or(
            isNull(recurringTransactionRules.endDate),
            gte(recurringTransactionRules.endDate, periodStart),
          ),
        ),
      );
  },

  async findForUser(id, userId) {
    const [rule] = await db
      .select()
      .from(recurringTransactionRules)
      .where(
        and(eq(recurringTransactionRules.id, id), eq(recurringTransactionRules.userId, userId)),
      )
      .limit(1);
    if (!rule) return null;
    const [ownerRecord] = await db
      .select({ personRole: people.role })
      .from(people)
      .where(and(eq(people.id, rule.personId), eq(people.userId, userId)))
      .limit(1);
    const owner = ownerRecord as { personRole: "admin" | "external" };
    const splits = await db
      .select({
        personId: recurringTransactionSplits.personId,
        amount: recurringTransactionSplits.amount,
        personRole: people.role,
      })
      .from(recurringTransactionSplits)
      .innerJoin(
        people,
        and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionSplits.userId, userId),
          eq(recurringTransactionSplits.recurringRuleId, id),
        ),
      );
    return { ...rule, personRole: owner.personRole, splits };
  },

  async listOccurrenceStates(userId, seriesIds, startDate, endDate) {
    if (!seriesIds.length) return [];
    return db
      .select({
        recurringSeriesId: recurringTransactionOccurrences.recurringSeriesId,
        purchaseDate: recurringTransactionOccurrences.purchaseDate,
        isSettled: recurringTransactionOccurrences.isSettled,
      })
      .from(recurringTransactionOccurrences)
      .where(
        and(
          eq(recurringTransactionOccurrences.userId, userId),
          inArray(recurringTransactionOccurrences.recurringSeriesId, seriesIds),
          sql`${recurringTransactionOccurrences.purchaseDate} between ${startDate} and ${endDate}`,
        ),
      );
  },

  async listSplitPeople(userId, ruleIds) {
    if (!ruleIds.length) return [];
    return db
      .select({
        recurringRuleId: recurringTransactionSplits.recurringRuleId,
        personId: recurringTransactionSplits.personId,
        personName: people.name,
        personAvatarUrl: people.avatarUrl,
        amount: recurringTransactionSplits.amount,
      })
      .from(recurringTransactionSplits)
      .innerJoin(
        people,
        and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, userId)),
      )
      .where(
        and(
          eq(recurringTransactionSplits.userId, userId),
          inArray(recurringTransactionSplits.recurringRuleId, ruleIds),
        ),
      );
  },

  async versionForUser(input) {
    return db.transaction(async (transaction) => {
      const [rule] = await transaction
        .select()
        .from(recurringTransactionRules)
        .where(
          and(
            eq(recurringTransactionRules.id, input.id),
            eq(recurringTransactionRules.userId, input.userId),
          ),
        )
        .limit(1)
        .for("update");
      if (!rule) return false;
      if (input.mode === "resume" && (rule.status !== "paused" || rule.endDate !== null)) {
        return false;
      }
      if (input.mode !== "resume" && input.mode !== "stop" && rule.status !== "active") {
        return false;
      }
      if (input.mode === "stop" && !["active", "paused"].includes(rule.status)) return false;
      const splits = await transaction
        .select({
          personId: recurringTransactionSplits.personId,
          amount: recurringTransactionSplits.amount,
          personRole: people.role,
        })
        .from(recurringTransactionSplits)
        .innerJoin(
          people,
          and(eq(recurringTransactionSplits.personId, people.id), eq(people.userId, input.userId)),
        )
        .where(
          and(
            eq(recurringTransactionSplits.userId, input.userId),
            eq(recurringTransactionSplits.recurringRuleId, rule.id),
          ),
        );

      await transaction
        .update(recurringTransactionRules)
        .set({
          endDate: new Date(`${previousCalendarDate(input.effectiveDate)}T00:00:00.000Z`),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(recurringTransactionRules.id, rule.id),
            eq(recurringTransactionRules.userId, input.userId),
          ),
        );

      const clone = async (
        startDate: string,
        endDate: string | null,
        changes?: {
          name: string;
          amount: string;
          splitShares?: Array<{ personId: string; amount: string }>;
        },
        status: "active" | "paused" = "active",
      ) => {
        const [createdRecord] = await transaction
          .insert(recurringTransactionRules)
          .values({
            userId: rule.userId,
            seriesId: rule.seriesId,
            personId: rule.personId,
            type: rule.type,
            paymentMethod: rule.paymentMethod,
            name: changes?.name ?? rule.name,
            amount: changes?.amount ?? rule.amount,
            anchorDate: rule.anchorDate,
            startDate: new Date(`${startDate}T00:00:00.000Z`),
            endDate: endDate ? new Date(`${endDate}T00:00:00.000Z`) : null,
            frequency: rule.frequency,
            accountId: rule.accountId,
            cardId: rule.cardId,
            categoryId: rule.categoryId,
            sourceAccountId: rule.sourceAccountId,
            destinationAccountId: rule.destinationAccountId,
            dueDate: rule.dueDate,
            isSettled: rule.isSettled,
            note: rule.note,
            status,
          })
          .returning({ id: recurringTransactionRules.id });
        const created = createdRecord as { id: string };
        const clonedSplits = changes?.splitShares ?? splits;
        if (clonedSplits.length) {
          await transaction.insert(recurringTransactionSplits).values(
            clonedSplits.map((split) => ({
              userId: input.userId,
              recurringRuleId: created.id,
              personId: split.personId,
              amount: split.amount,
            })),
          );
        }
        return created.id;
      };

      let effectiveVersionId: string | null = null;
      if (input.mode === "editFuture") {
        effectiveVersionId = await clone(
          input.effectiveDate,
          rule.endDate?.toISOString().slice(0, 10) ?? null,
          input.changes,
        );
      }
      if (input.mode === "editSingle") {
        effectiveVersionId = await clone(input.effectiveDate, input.effectiveDate, input.changes);
        if (input.nextDate) {
          await clone(input.nextDate, rule.endDate?.toISOString().slice(0, 10) ?? null);
        }
      }
      if (input.mode === "skip" && input.nextDate) {
        await clone(input.nextDate, rule.endDate?.toISOString().slice(0, 10) ?? null);
      }
      if (input.mode === "pause") {
        await clone(
          input.effectiveDate,
          rule.endDate?.toISOString().slice(0, 10) ?? null,
          undefined,
          "paused",
        );
      }
      if (input.mode === "resume") {
        effectiveVersionId = await clone(
          input.effectiveDate,
          rule.endDate?.toISOString().slice(0, 10) ?? null,
        );
      }

      if (!effectiveVersionId) {
        await transaction
          .delete(recurringTransactionOccurrences)
          .where(
            and(
              eq(recurringTransactionOccurrences.userId, input.userId),
              eq(recurringTransactionOccurrences.recurringSeriesId, rule.seriesId),
              eq(
                recurringTransactionOccurrences.purchaseDate,
                new Date(`${input.effectiveDate}T00:00:00.000Z`),
              ),
            ),
          );
      } else {
        await transaction
          .update(recurringTransactionOccurrences)
          .set({ recurringRuleId: effectiveVersionId, updatedAt: new Date() })
          .where(
            and(
              eq(recurringTransactionOccurrences.userId, input.userId),
              eq(recurringTransactionOccurrences.recurringSeriesId, rule.seriesId),
              eq(
                recurringTransactionOccurrences.purchaseDate,
                new Date(`${input.effectiveDate}T00:00:00.000Z`),
              ),
            ),
          );
      }
      return true;
    });
  },
} satisfies RecurringExpensesRepository;

function previousCalendarDate(date: string) {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}
