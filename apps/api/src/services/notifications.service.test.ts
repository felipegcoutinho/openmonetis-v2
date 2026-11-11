import assert from "node:assert/strict";
import test from "node:test";
import { createNotificationsService, type NotificationsRepository } from "./notifications.service";

function fixture() {
  const now = new Date("2020-01-10T12:00:00Z");
  const states: Awaited<ReturnType<NotificationsRepository["listForKeys"]>> = [];
  const writes: unknown[][] = [];
  const reads: unknown[][] = [];
  const repository: NotificationsRepository = {
    async listForKeys(user, keys) {
      assert.equal(user, "owner");
      reads.push([user, keys]);
      return states.filter((s) => keys.includes(s.notificationKey));
    },
    async save(user, state) {
      writes.push([user, state]);
      const index = states.findIndex((s) => s.notificationKey === state.notificationKey);
      if (index < 0) states.push(state);
      else states[index] = state;
    },
  };
  const sources: Parameters<typeof createNotificationsService>[1] = {
    bills: {
      async get(period, user) {
        reads.push(["bills", user, period]);
        return { period, totalOpen: 0, overdueCount: 0, accounts: [], items: [] };
      },
    },
    invoices: {
      async get(period, user) {
        reads.push(["invoices", user, period]);
        return { period, totalRemaining: 0, accounts: [], items: [] };
      },
    },
    budgets: {
      async list(user, { period }) {
        assert.equal(user, "owner");
        return {
          period,
          allocatedAmount: 0,
          actualSpentAmount: 0,
          projectedAmount: 0,
          committedAmount: 0,
          availableAmount: 0,
          exceededAmount: 0,
          usagePercentage: 0,
          unbudgetedCommittedAmount: 0,
          unbudgetedItems: [],
          warningCount: 0,
          items: [],
        };
      },
    },
    inbox: {
      async snapshot(user, limit) {
        assert.equal(user, "owner");
        assert.equal(limit, 1);
        return {
          pendingCount: 1,
          recentItems: [
            {
              id: "inbox",
              sourceAppName: "Bank",
              parsedName: "Purchase",
              parsedAmount: 10,
              notificationTimestamp: now.toISOString(),
            },
          ],
        };
      },
    },
    externalExpenses: {
      async summary(user) {
        assert.equal(user, "owner");
        return {
          pendingCount: 0,
          totalAmount: 0,
          counterpartCount: 0,
          latestCounterpartName: null,
          latestUpdatedAt: null,
          latestPeriod: null,
        };
      },
    },
    notes: {
      async listTaskReminders(user, dueBy) {
        assert.equal(user, "owner");
        assert.equal(dueBy, "2020-01-13");
        return [
          { id: "task", title: "Reminder", dueDate: "2020-01-11", updatedAt: now.toISOString() },
        ];
      },
    },
  };
  return {
    states,
    writes,
    reads,
    sources,
    repository,
    service: createNotificationsService(
      repository,
      sources,
      {
        get: async (user) => {
          assert.equal(user, "owner");
          return { notificationDueSoonDays: 3 };
        },
      },
      { now: () => now, today: () => "2020-01-10", currentPeriod: () => "2020-01" },
    ),
  };
}

test("notifications read owned sources across year boundaries and count active unread items", async () => {
  const f = fixture();
  const result = await f.service.list("owner");
  assert.equal(result.items.length, 2);
  assert.equal(result.unreadCount, 2);
  assert.equal(result.activeCount, 2);
  assert.equal(result.archivedCount, 0);
  assert.equal(result.generatedAt, "2020-01-10T12:00:00.000Z");
  for (const source of ["bills", "invoices"])
    assert.deepEqual(
      f.reads.filter((row) => row[0] === source),
      ["2019-11", "2019-12", "2020-01", "2020-02"].map((period) => [source, "owner", period]),
    );
  assert.deepEqual(f.writes, []);
});

test("reading and unreading a notification persists the current fingerprint and timestamps", async () => {
  const f = fixture();
  const item = (await f.service.list("owner")).items[0];
  await f.service.update(
    item.notificationKey,
    { fingerprint: item.fingerprint, isRead: true },
    "owner",
  );
  assert.equal((await f.service.list("owner")).unreadCount, 1);
  assert.equal(f.states[0].readAt, "2020-01-10T12:00:00.000Z");
  await f.service.update(
    item.notificationKey,
    { fingerprint: item.fingerprint, isRead: false },
    "owner",
  );
  assert.equal((await f.service.list("owner")).unreadCount, 2);
});

for (const scenario of ["missing", "stale", "required action"] as const)
  test(`notification update rejects ${scenario} before writing`, async () => {
    const f = fixture();
    if (scenario === "required action")
      f.sources.externalExpenses.summary = async () => ({
        pendingCount: 1,
        totalAmount: 10,
        counterpartCount: 1,
        latestCounterpartName: "Guest",
        latestUpdatedAt: "2020-01-10T12:00:00Z",
        latestPeriod: "2020-01",
      });
    const items = (await f.service.list("owner")).items;
    const item = scenario === "required action" ? items.find((item) => !item.canArchive) : items[0];
    assert.ok(item);
    await assert.rejects(
      f.service.update(
        scenario === "missing" ? "foreign" : item.notificationKey,
        {
          fingerprint: scenario === "stale" ? "outdated" : item.fingerprint,
          isArchived: scenario === "required action",
        },
        "owner",
      ),
      {
        code:
          scenario === "missing"
            ? "notification_not_found"
            : scenario === "stale"
              ? "notification_state_conflict"
              : "notification_archive_not_allowed",
      },
    );
    assert.deepEqual(f.writes, []);
  });

test("archived notification states are excluded from active and unread counts", async () => {
  const f = fixture();
  const item = (await f.service.list("owner")).items[0];
  f.states.push({
    notificationKey: item.notificationKey,
    fingerprint: item.fingerprint,
    readAt: "2020-01-10T12:00:00Z",
    archivedAt: "2020-01-10T12:00:00Z",
  });
  const result = await f.service.list("owner");
  assert.equal(result.archivedCount, 1);
  assert.equal(result.activeCount, 1);
  assert.equal(result.unreadCount, 1);
});

for (const source of ["bills", "state read", "state write"] as const)
  test(`notification ${source} failure propagates without a partial state update`, async () => {
    const f = fixture();
    const item = (await f.service.list("owner")).items[0];
    const failure = new Error("Source unavailable");
    const fail = async () => {
      throw failure;
    };
    if (source === "bills") f.sources.bills.get = fail;
    else if (source === "state read") f.repository.listForKeys = fail;
    else f.repository.save = fail;
    await assert.rejects(
      f.service.update(
        item.notificationKey,
        { fingerprint: item.fingerprint, isRead: true },
        "owner",
      ),
      (error) => error === failure,
    );
    assert.deepEqual(f.writes, []);
  });
