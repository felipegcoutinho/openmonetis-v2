import { categories, db, inboxItems, inboxRules, people } from "@openmonetis/db";
import type { InboxRuleCondition } from "@openmonetis/domain/inbox-rules";
import { and, asc, eq, sql } from "drizzle-orm";
import type { InboxRuleRecord, InboxRulesRepository } from "../services/inbox-rules.service";

const ruleSelection = {
  id: inboxRules.id,
  userId: inboxRules.userId,
  name: inboxRules.name,
  priority: inboxRules.priority,
  isActive: inboxRules.isActive,
  matchMode: inboxRules.matchMode,
  conditions: inboxRules.conditions,
  categoryId: inboxRules.categoryId,
  categoryName: categories.name,
  categoryType: categories.type,
  personId: inboxRules.personId,
  personName: people.name,
  personStatus: people.status,
  version: inboxRules.version,
  createdAt: inboxRules.createdAt,
  updatedAt: inboxRules.updatedAt,
};

type RuleSelectionRow = {
  id: string;
  userId: string;
  name: string;
  priority: number;
  isActive: boolean;
  matchMode: "all" | "any";
  conditions: unknown;
  categoryId: string | null;
  categoryName: string | null;
  categoryType: "income" | "expense" | null;
  personId: string | null;
  personName: string | null;
  personStatus: "active" | "inactive" | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
};

export const inboxRulesRepository = {
  async listByUser(userId) {
    const rows = await selectRules()
      .where(eq(inboxRules.userId, userId))
      .orderBy(asc(inboxRules.priority), asc(inboxRules.name), asc(inboxRules.id));
    return rows.map(toRecord);
  },

  async listActiveByUser(userId) {
    const rows = await selectRules()
      .where(and(eq(inboxRules.userId, userId), eq(inboxRules.isActive, true)))
      .orderBy(asc(inboxRules.priority), asc(inboxRules.name), asc(inboxRules.id));
    return rows.map(toRecord);
  },

  async findByIdForUser(id, userId) {
    return findRule(id, userId);
  },

  async insert(data) {
    const [inserted] = await db
      .insert(inboxRules)
      .values(data)
      .onConflictDoNothing({ target: [inboxRules.userId, inboxRules.name] })
      .returning({ id: inboxRules.id });
    return inserted ? findRule(inserted.id, data.userId) : null;
  },

  async replaceForUser(id, userId, expectedVersion, data) {
    try {
      const [updated] = await db
        .update(inboxRules)
        .set({
          ...data,
          version: sql`${inboxRules.version} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(inboxRules.id, id),
            eq(inboxRules.userId, userId),
            eq(inboxRules.version, expectedVersion),
          ),
        )
        .returning({ id: inboxRules.id });
      if (updated) {
        return { status: "updated" as const, record: await requireUpdatedRule(id, userId) };
      }
      return (await ruleExists(id, userId))
        ? { status: "version_conflict" as const }
        : { status: "not_found" as const };
    } catch (error) {
      if (isUniqueViolation(error)) return { status: "name_conflict" as const };
      throw error;
    }
  },

  async setActiveForUser(id, userId, expectedVersion, isActive) {
    const [updated] = await db
      .update(inboxRules)
      .set({
        isActive,
        version: sql`${inboxRules.version} + 1`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(inboxRules.id, id),
          eq(inboxRules.userId, userId),
          eq(inboxRules.version, expectedVersion),
        ),
      )
      .returning({ id: inboxRules.id });
    if (updated) {
      return { status: "updated" as const, record: await requireUpdatedRule(id, userId) };
    }
    return (await ruleExists(id, userId))
      ? { status: "version_conflict" as const }
      : { status: "not_found" as const };
  },

  async deleteForUser(id, userId, expectedVersion) {
    const [deleted] = await db
      .delete(inboxRules)
      .where(
        and(
          eq(inboxRules.id, id),
          eq(inboxRules.userId, userId),
          eq(inboxRules.version, expectedVersion),
        ),
      )
      .returning({ id: inboxRules.id });
    if (deleted) return "deleted";
    return (await ruleExists(id, userId)) ? "version_conflict" : "not_found";
  },

  async findCategoryForUser(id, userId) {
    const [category] = await db
      .select({ id: categories.id, type: categories.type })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .limit(1);
    return category ?? null;
  },

  async findPersonForUser(id, userId) {
    const [person] = await db
      .select({ id: people.id, status: people.status })
      .from(people)
      .where(and(eq(people.id, id), eq(people.userId, userId)))
      .limit(1);
    return person ?? null;
  },

  async findInboxItemForUser(id, userId) {
    const [item] = await db
      .select({
        sourceApp: inboxItems.sourceApp,
        sourceAppName: inboxItems.sourceAppName,
        originalTitle: inboxItems.originalTitle,
        originalText: inboxItems.originalText,
        parsedName: inboxItems.parsedName,
        parsedAmount: inboxItems.parsedAmount,
        status: inboxItems.status,
      })
      .from(inboxItems)
      .where(and(eq(inboxItems.id, id), eq(inboxItems.userId, userId)))
      .limit(1);
    return item
      ? {
          ...item,
          parsedAmount: item.parsedAmount === null ? null : Number(item.parsedAmount),
        }
      : null;
  },
} satisfies InboxRulesRepository;

function selectRules() {
  return db
    .select(ruleSelection)
    .from(inboxRules)
    .leftJoin(
      categories,
      and(eq(categories.id, inboxRules.categoryId), eq(categories.userId, inboxRules.userId)),
    )
    .leftJoin(
      people,
      and(eq(people.id, inboxRules.personId), eq(people.userId, inboxRules.userId)),
    );
}

async function findRule(id: string, userId: string) {
  const [row] = await selectRules()
    .where(and(eq(inboxRules.id, id), eq(inboxRules.userId, userId)))
    .limit(1);
  return row ? toRecord(row) : null;
}

async function ruleExists(id: string, userId: string) {
  const [row] = await db
    .select({ id: inboxRules.id })
    .from(inboxRules)
    .where(and(eq(inboxRules.id, id), eq(inboxRules.userId, userId)))
    .limit(1);
  return Boolean(row);
}

async function requireUpdatedRule(id: string, userId: string) {
  const rule = await findRule(id, userId);
  if (!rule) throw new Error("Updated inbox rule could not be loaded");
  return rule;
}

function toRecord(row: RuleSelectionRow) {
  return {
    ...row,
    conditions: row.conditions as InboxRuleCondition[],
  } satisfies InboxRuleRecord;
}

function isUniqueViolation(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "23505");
}
