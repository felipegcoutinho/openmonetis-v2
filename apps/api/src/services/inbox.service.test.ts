import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { createInboxService, type InboxItemRecord, type InboxRepository } from "./inbox.service";
import type { InboxRuleRecord } from "./inbox-rules.service";

const now = new Date("2026-08-10T12:00:00.000Z");
const userId = "00000000-0000-4000-8000-000000000001";
const deviceTokenId = "00000000-0000-4000-8000-000000000002";
const inboxId = "00000000-0000-4000-8000-000000000003";

function createRecord(overrides: Partial<InboxItemRecord> = {}): InboxItemRecord {
  return {
    id: inboxId,
    userId,
    deviceTokenId,
    sourceApp: "com.example.bank",
    sourceAppName: "Banco Example",
    originalTitle: "Compra aprovada",
    originalText: "Compra de R$ 10,00",
    notificationTimestamp: now,
    parsedName: "Compra",
    parsedAmount: "10.00",
    clientId: "notification-1",
    payloadFingerprint: "fingerprint",
    status: "pending",
    transactionId: null,
    processedAt: null,
    discardedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createRepository(overrides: Partial<InboxRepository> = {}): InboxRepository {
  return {
    insertOrFind: async (draft) => ({
      record: createRecord({ ...draft, payloadFingerprint: draft.payloadFingerprint }),
      duplicate: false,
    }),
    listForUser: async () => ({
      items: [],
      sourceApps: [],
      notificationDates: [],
      total: 0,
      counts: { pending: 0, processed: 0, discarded: 0 },
      pendingAmountItems: [],
      activeCards: [],
      activeAccounts: [],
    }),
    listRuleCandidatesForUser: async () => [],
    snapshotForUser: async () => ({ items: [], pendingCount: 0 }),
    findByIdForUser: async () => null,
    transactionExistsForUser: async () => false,
    transitionForUser: async () => null,
    deleteForUser: async () => false,
    deleteByStatusForUser: async () => 0,
    ...overrides,
  };
}

function input(clientId = "notification-1") {
  return {
    sourceApp: "com.example.bank",
    sourceAppName: " Banco   Example ",
    originalTitle: "Compra aprovada",
    originalText: "Compra de R$ 10,00",
    notificationTimestamp: now.toISOString(),
    timestampFormatVersion: 2 as const,
    parsedName: "Compra",
    parsedAmount: 10,
    clientId,
  };
}

test("legacy Companion timestamps are interpreted as Brazil wall-clock time", async () => {
  let receivedTimestamp: Date | null = null;
  const service = createInboxService(
    createRepository({
      insertOrFind: async (draft) => {
        receivedTimestamp = draft.notificationTimestamp;
        return {
          record: createRecord({ ...draft }),
          duplicate: false,
        };
      },
    }),
    { now: () => now },
  );

  const legacyInput = input();
  const { timestampFormatVersion: _version, ...withoutVersion } = legacyInput;
  await service.ingest(
    { ...withoutVersion, notificationTimestamp: "2026-08-10T09:00:00.000Z" },
    { userId, deviceTokenId },
  );

  assert.equal((receivedTimestamp as Date | null)?.toISOString(), now.toISOString());
});

test("inbox ingestion derives a stable fingerprint and accepts idempotent duplicates", async () => {
  let firstFingerprint = "";
  const repository = createRepository({
    insertOrFind: async (draft) => {
      firstFingerprint ||= draft.payloadFingerprint;
      return {
        record: createRecord({ ...draft, payloadFingerprint: firstFingerprint }),
        duplicate: firstFingerprint === draft.payloadFingerprint,
      };
    },
  });
  const service = createInboxService(repository, { now: () => now });

  const first = await service.ingest(input(), { userId, deviceTokenId });
  const duplicate = await service.ingest(input(), { userId, deviceTokenId });

  assert.equal(first.id, inboxId);
  assert.equal(duplicate.duplicate, true);
  assert.match(firstFingerprint, /^[a-f0-9]{64}$/);
});

test("batch ingestion exposes only expected application error codes", async () => {
  const service = createInboxService(
    createRepository({
      insertOrFind: async (draft) => {
        if (draft.clientId === "database-error") {
          throw Object.assign(new Error("database detail"), { code: "23505" });
        }
        return {
          record: createRecord({ ...draft, payloadFingerprint: "different" }),
          duplicate: true,
        };
      },
    }),
    { now: () => now },
  );

  const conflictResults = await service.ingestBatch([input("known-conflict")], {
    userId,
    deviceTokenId,
  });
  assert.deepEqual(conflictResults, [
    {
      clientId: "known-conflict",
      serverId: null,
      success: false,
      error: "inbox_idempotency_conflict",
    },
  ]);

  await assert.rejects(
    service.ingestBatch([input("database-error")], { userId, deviceTokenId }),
    /database detail/,
  );
});

test("processing validates transaction ownership and uses a compare-and-set transition", async () => {
  const transactionId = "00000000-0000-4000-8000-000000000004";
  let transitionUserId = "";
  const service = createInboxService(
    createRepository({
      findByIdForUser: async () => createRecord(),
      transactionExistsForUser: async (id, ownerId) => id === transactionId && ownerId === userId,
      transitionForUser: async (transition) => {
        transitionUserId = transition.userId;
        return createRecord({
          status: transition.targetStatus,
          transactionId: transition.transactionId ?? null,
          processedAt: transition.changedAt,
        });
      },
    }),
    { now: () => now },
  );

  const processed = await service.process(inboxId, transactionId, userId);
  assert.equal(processed.status, "processed");
  assert.equal(processed.transactionId, transactionId);
  assert.equal(transitionUserId, userId);
});

test("confirmation delegates transaction creation with the inbox identity and timestamp", async () => {
  let receivedInboxItemId = "";
  let receivedUserId = "";
  let receivedConfirmedAt: Date | null = null;
  const expected = { recordId: "00000000-0000-4000-8000-000000000004" } as TransactionOutput;
  const service = createInboxService(
    createRepository({ findByIdForUser: async () => createRecord() }),
    {
      now: () => now,
      transactionCreator: {
        createTransactionFromInbox: async (_input, ownerId, itemId, confirmedAt) => {
          receivedInboxItemId = itemId;
          receivedUserId = ownerId;
          receivedConfirmedAt = confirmedAt;
          return expected;
        },
      },
    },
  );

  const result = await service.confirm(
    inboxId,
    {
      type: "expense",
      condition: "single",
      paymentMethod: "pix",
      name: "Compra",
      amount: 10,
      purchaseDate: "2026-08-10",
      personId: userId,
      categoryId: "00000000-0000-4000-8000-000000000005",
    },
    userId,
  );

  assert.equal(result, expected);
  assert.equal(receivedInboxItemId, inboxId);
  assert.equal(receivedUserId, userId);
  assert.equal(receivedConfirmedAt, now);
});

test("clearing inbox history deletes only the requested owned status", async () => {
  let receivedStatus = "";
  let receivedUserId = "";
  const service = createInboxService(
    createRepository({
      deleteByStatusForUser: async (status, ownerId) => {
        receivedStatus = status;
        receivedUserId = ownerId;
        return 7;
      },
    }),
  );

  assert.deepEqual(await service.clear("processed", userId), {
    status: "processed",
    deletedCount: 7,
  });
  assert.equal(receivedStatus, "processed");
  assert.equal(receivedUserId, userId);
});

test("rule filtering resolves applied rules before inbox pagination", async () => {
  const ruleId = "00000000-0000-4000-8000-000000000010";
  const categoryId = "00000000-0000-4000-8000-000000000011";
  const rule: InboxRuleRecord = {
    id: ruleId,
    userId,
    name: "Uber",
    priority: 1,
    isActive: true,
    matchMode: "all",
    conditions: [{ field: "parsedName", operator: "contains", value: "Uber" }],
    categoryId,
    categoryName: "Transporte",
    categoryType: "expense",
    personId: null,
    personName: null,
    personStatus: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  const candidates = [
    createRecord({ id: "00000000-0000-4000-8000-000000000020", parsedName: "Mercado" }),
    createRecord({ id: "00000000-0000-4000-8000-000000000021", parsedName: "Uber ida" }),
    createRecord({ id: "00000000-0000-4000-8000-000000000022", parsedName: "Uber volta" }),
  ];
  let receivedIds: string[] | undefined;
  const service = createInboxService(
    createRepository({
      listRuleCandidatesForUser: async (ownerId) => {
        assert.equal(ownerId, userId);
        return candidates;
      },
      listForUser: async (_ownerId, query, matchingItemIds) => {
        receivedIds = matchingItemIds;
        const matches = candidates.filter((item) => matchingItemIds?.includes(item.id));
        return {
          items: matches.slice((query.page - 1) * query.pageSize, query.page * query.pageSize),
          sourceApps: [],
          notificationDates: [],
          total: matches.length,
          counts: { pending: candidates.length, processed: 0, discarded: 0 },
          pendingAmountItems: [],
          activeCards: [],
          activeAccounts: [],
        };
      },
    }),
    { rulesRepository: { listActiveByUser: async () => [rule] } },
  );

  const result = await service.list({ status: "pending", page: 2, pageSize: 1, ruleId }, userId);

  assert.deepEqual(receivedIds, [candidates[1].id, candidates[2].id]);
  assert.equal(result.total, 2);
  assert.equal(result.totalPages, 2);
  assert.deepEqual(
    result.items.map((item) => item.id),
    [candidates[2].id],
  );
});

test("rule filtering excludes a matching rule when an earlier rule filled its only field", async () => {
  const categoryId = "00000000-0000-4000-8000-000000000011";
  const laterRuleId = "00000000-0000-4000-8000-000000000012";
  const ruleBase: InboxRuleRecord = {
    id: "00000000-0000-4000-8000-000000000010",
    userId,
    name: "Primeira",
    priority: 1,
    isActive: true,
    matchMode: "all",
    conditions: [{ field: "parsedName", operator: "contains", value: "Uber" }],
    categoryId,
    categoryName: "Transporte",
    categoryType: "expense",
    personId: null,
    personName: null,
    personStatus: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  let matchingIds: string[] | undefined;
  const service = createInboxService(
    createRepository({
      listRuleCandidatesForUser: async () => [createRecord({ parsedName: "Uber" })],
      listForUser: async (_ownerId, _query, ids) => {
        matchingIds = ids;
        return {
          items: [],
          sourceApps: [],
          notificationDates: [],
          total: 0,
          counts: { pending: 1, processed: 0, discarded: 0 },
          pendingAmountItems: [],
          activeCards: [],
          activeAccounts: [],
        };
      },
    }),
    {
      rulesRepository: {
        listActiveByUser: async () => [
          ruleBase,
          { ...ruleBase, id: laterRuleId, name: "Segunda", priority: 2 },
        ],
      },
    },
  );

  await service.list({ status: "pending", page: 1, pageSize: 20, ruleId: laterRuleId }, userId);
  assert.deepEqual(matchingIds, []);
});
