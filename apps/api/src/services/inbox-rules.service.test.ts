import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../utils/errors";
import {
  createInboxRulesService,
  type InboxRuleRecord,
  type InboxRulesRepository,
} from "./inbox-rules.service";

const userId = "00000000-0000-4000-8000-000000000001";
const inboxItemId = "00000000-0000-4000-8000-000000000002";
const categoryId = "00000000-0000-4000-8000-000000000003";
const personId = "00000000-0000-4000-8000-000000000004";
const now = new Date("2026-09-02T12:00:00.000Z");

function record(overrides: Partial<InboxRuleRecord> = {}): InboxRuleRecord {
  return {
    id: "00000000-0000-4000-8000-000000000005",
    userId,
    name: "Compras no iFood",
    priority: 100,
    isActive: true,
    matchMode: "all",
    conditions: [{ field: "originalText", operator: "contains", value: "ifood" }],
    categoryId,
    categoryName: "Alimentação",
    categoryType: "expense",
    personId,
    personName: "Felipe",
    personStatus: "active",
    version: 1,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function repository(overrides: Partial<InboxRulesRepository> = {}): InboxRulesRepository {
  return {
    listByUser: async () => [],
    listActiveByUser: async () => [],
    findByIdForUser: async () => null,
    insert: async (draft) => record(draft),
    replaceForUser: async () => ({ status: "not_found" }),
    setActiveForUser: async () => ({ status: "not_found" }),
    deleteForUser: async () => "not_found",
    findCategoryForUser: async (id, ownerId) =>
      id === categoryId && ownerId === userId ? { id, type: "expense" } : null,
    findPersonForUser: async (id, ownerId) =>
      id === personId && ownerId === userId ? { id, status: "active" } : null,
    findInboxItemForUser: async () => null,
    ...overrides,
  };
}

test("inbox rule creation validates targets through user-scoped repository methods", async () => {
  let insertedUserId = "";
  const service = createInboxRulesService(
    repository({
      insert: async (draft) => {
        insertedUserId = draft.userId;
        return record(draft);
      },
    }),
  );

  const created = await service.create(
    {
      name: "  Compras   no iFood ",
      priority: 10,
      isActive: true,
      matchMode: "all",
      conditions: [{ field: "originalText", operator: "contains", value: "IFOOD" }],
      categoryId,
      personId,
    },
    userId,
  );

  assert.equal(insertedUserId, userId);
  assert.equal(created.name, "Compras no iFood");
  assert.equal(created.category?.id, categoryId);
  assert.equal(created.person?.id, personId);
});

test("inbox rule creation rejects categories that are not owned expense categories", async () => {
  const service = createInboxRulesService(repository({ findCategoryForUser: async () => null }));

  await assert.rejects(
    service.create(
      {
        name: "Regra",
        priority: 100,
        isActive: true,
        matchMode: "all",
        conditions: [{ field: "originalText", operator: "contains", value: "compra" }],
        categoryId,
        personId: null,
      },
      userId,
    ),
    (error) =>
      error instanceof ApiError &&
      error.status === 400 &&
      error.code === "inbox_rule_category_unavailable",
  );
});

test("suggestion resolution only exposes available targets from active rules", async () => {
  const service = createInboxRulesService(
    repository({
      findInboxItemForUser: async (id, ownerId) =>
        id === inboxItemId && ownerId === userId
          ? {
              sourceApp: "com.bank",
              sourceAppName: "Banco",
              originalTitle: "Compra aprovada",
              originalText: "Compra aprovada no IFOOD",
              parsedName: "iFood",
              parsedAmount: 42.9,
              status: "pending",
            }
          : null,
      listActiveByUser: async () => [
        record(),
        record({
          id: "00000000-0000-4000-8000-000000000006",
          name: "Pessoa indisponível",
          priority: 1,
          categoryId: null,
          categoryName: null,
          categoryType: null,
          personId: "00000000-0000-4000-8000-000000000007",
          personName: "Inativa",
          personStatus: "inactive",
        }),
      ],
    }),
  );

  const suggestion = await service.resolveSuggestion(inboxItemId, userId);

  assert.equal(suggestion.categoryId, categoryId);
  assert.equal(suggestion.personId, personId);
  assert.deepEqual(suggestion.appliedRules[0]?.fields, ["categoryId", "personId"]);
});

test("suggestions reject inbox items that are no longer pending", async () => {
  const service = createInboxRulesService(
    repository({
      findInboxItemForUser: async () => ({
        sourceApp: "com.bank",
        sourceAppName: "Banco",
        originalTitle: null,
        originalText: "Compra",
        parsedName: null,
        parsedAmount: null,
        status: "processed",
      }),
    }),
  );

  await assert.rejects(
    service.resolveSuggestion(inboxItemId, userId),
    (error) => error instanceof ApiError && error.code === "inbox_item_not_pending",
  );
});
