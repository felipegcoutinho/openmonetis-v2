import type { InboxItemStatus } from "@openmonetis/domain/inbox";
import {
  createInboxRuleDraft,
  type InboxRuleCandidate,
  type InboxRuleCondition,
  InboxRuleError,
  type InboxRuleMatchItem,
  type InboxRuleMatchMode,
  resolveInboxRules,
} from "@openmonetis/domain/inbox-rules";
import type {
  CreateInboxRuleInput,
  InboxRuleOutput,
  ReplaceInboxRuleInput,
  SetInboxRuleActiveInput,
} from "@openmonetis/validators/inbox-rules";
import { badRequest, conflict, notFound } from "../utils/errors";

export type InboxRuleRecord = {
  id: string;
  userId: string;
  name: string;
  priority: number;
  isActive: boolean;
  matchMode: InboxRuleMatchMode;
  conditions: InboxRuleCondition[];
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

export type InboxRuleWriteRecord = Omit<
  InboxRuleRecord,
  | "id"
  | "categoryName"
  | "categoryType"
  | "personName"
  | "personStatus"
  | "version"
  | "createdAt"
  | "updatedAt"
>;

type InboxRuleMutationResult =
  | { status: "updated"; record: InboxRuleRecord }
  | { status: "not_found" | "version_conflict" | "name_conflict" };

export type InboxRulesRepository = {
  listByUser(userId: string): Promise<InboxRuleRecord[]>;
  listActiveByUser(userId: string): Promise<InboxRuleRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<InboxRuleRecord | null>;
  insert(data: InboxRuleWriteRecord): Promise<InboxRuleRecord | null>;
  replaceForUser(
    id: string,
    userId: string,
    expectedVersion: number,
    data: Omit<InboxRuleWriteRecord, "userId">,
  ): Promise<InboxRuleMutationResult>;
  setActiveForUser(
    id: string,
    userId: string,
    expectedVersion: number,
    isActive: boolean,
  ): Promise<InboxRuleMutationResult>;
  deleteForUser(
    id: string,
    userId: string,
    expectedVersion: number,
  ): Promise<"deleted" | "not_found" | "version_conflict">;
  findCategoryForUser(
    id: string,
    userId: string,
  ): Promise<{ id: string; type: "income" | "expense" } | null>;
  findPersonForUser(
    id: string,
    userId: string,
  ): Promise<{ id: string; status: "active" | "inactive" } | null>;
  findInboxItemForUser(
    id: string,
    userId: string,
  ): Promise<(InboxRuleMatchItem & { status: InboxItemStatus }) | null>;
};

export function createInboxRulesService(repository: InboxRulesRepository) {
  return {
    async list(userId: string) {
      const items = await repository.listByUser(userId);
      return { items: items.map(toOutput), total: items.length };
    },

    async create(input: CreateInboxRuleInput, userId: string) {
      await assertTargetsAvailable(input.categoryId, input.personId, userId, repository);
      const draft = buildDraft(input, userId);
      const record = await repository.insert(draft);
      if (!record) {
        throw conflict("Inbox rule name is already in use", "inbox_rule_name_conflict");
      }
      return toOutput(record);
    },

    async replace(id: string, input: ReplaceInboxRuleInput, userId: string) {
      await findRule(id, userId, repository);
      await assertTargetsAvailable(input.categoryId, input.personId, userId, repository);
      const { userId: _userId, ...draft } = buildDraft(input, userId);
      const result = await repository.replaceForUser(id, userId, input.expectedVersion, draft);
      return mutationOutput(result);
    },

    async setActive(id: string, input: SetInboxRuleActiveInput, userId: string) {
      await findRule(id, userId, repository);
      const result = await repository.setActiveForUser(
        id,
        userId,
        input.expectedVersion,
        input.isActive,
      );
      return mutationOutput(result);
    },

    async remove(id: string, expectedVersion: number, userId: string) {
      const result = await repository.deleteForUser(id, userId, expectedVersion);
      if (result === "deleted") return { id };
      if (result === "version_conflict") throw versionConflict();
      throw ruleNotFound();
    },

    async resolveSuggestion(inboxItemId: string, userId: string) {
      const item = await repository.findInboxItemForUser(inboxItemId, userId);
      if (!item) throw notFound("Inbox item not found", "inbox_item_not_found");
      if (item.status !== "pending") {
        throw badRequest(
          "Only pending inbox items can receive suggestions",
          "inbox_item_not_pending",
        );
      }

      const rules = (await repository.listActiveByUser(userId)).flatMap<InboxRuleCandidate>(
        (rule) => {
          const categoryId = rule.categoryType === "expense" ? rule.categoryId : null;
          const personId = rule.personStatus === "active" ? rule.personId : null;
          if (!categoryId && !personId) return [];
          return [
            {
              id: rule.id,
              name: rule.name,
              priority: rule.priority,
              isActive: rule.isActive,
              matchMode: rule.matchMode,
              conditions: rule.conditions,
              categoryId,
              personId,
            },
          ];
        },
      );
      const { status: _status, ...matchItem } = item;
      return resolveInboxRules(matchItem, rules);
    },
  };
}

function buildDraft(
  input: CreateInboxRuleInput | ReplaceInboxRuleInput,
  userId: string,
): InboxRuleWriteRecord {
  try {
    return createInboxRuleDraft({
      userId,
      name: input.name,
      priority: input.priority,
      isActive: input.isActive,
      matchMode: input.matchMode,
      conditions: input.conditions,
      categoryId: input.categoryId,
      personId: input.personId,
    });
  } catch (error) {
    if (error instanceof InboxRuleError) throw badRequest(error.message, error.code);
    throw error;
  }
}

async function assertTargetsAvailable(
  categoryId: string | null,
  personId: string | null,
  userId: string,
  repository: InboxRulesRepository,
) {
  const [category, person] = await Promise.all([
    categoryId ? repository.findCategoryForUser(categoryId, userId) : null,
    personId ? repository.findPersonForUser(personId, userId) : null,
  ]);
  if (categoryId && category?.type !== "expense") {
    throw badRequest(
      "Inbox rules can only use an owned expense category",
      "inbox_rule_category_unavailable",
    );
  }
  if (personId && person?.status !== "active") {
    throw badRequest(
      "Inbox rules can only use an owned active person",
      "inbox_rule_person_unavailable",
    );
  }
}

async function findRule(id: string, userId: string, repository: InboxRulesRepository) {
  const rule = await repository.findByIdForUser(id, userId);
  if (!rule) throw ruleNotFound();
  return rule;
}

function mutationOutput(result: InboxRuleMutationResult) {
  if (result.status === "updated") return toOutput(result.record);
  if (result.status === "name_conflict") {
    throw conflict("Inbox rule name is already in use", "inbox_rule_name_conflict");
  }
  if (result.status === "version_conflict") throw versionConflict();
  throw ruleNotFound();
}

function ruleNotFound() {
  return notFound("Inbox rule not found", "inbox_rule_not_found");
}

function versionConflict() {
  return conflict(
    "The inbox rule changed after it was opened. Reload it and try again",
    "inbox_rule_version_conflict",
  );
}

function toOutput(record: InboxRuleRecord): InboxRuleOutput {
  return {
    id: record.id,
    name: record.name,
    priority: record.priority,
    isActive: record.isActive,
    matchMode: record.matchMode,
    conditions: record.conditions,
    category:
      record.categoryId && record.categoryName
        ? { id: record.categoryId, name: record.categoryName }
        : null,
    person:
      record.personId && record.personName
        ? { id: record.personId, name: record.personName }
        : null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export type InboxRulesService = ReturnType<typeof createInboxRulesService>;
