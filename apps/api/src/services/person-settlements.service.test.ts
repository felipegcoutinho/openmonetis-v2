import assert from "node:assert/strict";
import test from "node:test";
import {
  createPersonSettlementsService,
  type PersonSettlementRecord,
  type PersonSettlementsRepository,
} from "./person-settlements.service";

const personId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";
const period = "2026-08";

const settlement: PersonSettlementRecord = {
  id: "00000000-0000-4000-8000-000000000003",
  userId,
  personId,
  invoicePaymentAllocationId: null,
  amount: "50.00",
  receivedAt: new Date("2026-08-15T00:00:00.000Z"),
  note: null,
  createdAt: new Date("2026-08-15T12:00:00.000Z"),
};

test("calculates a person's settlement snapshot only with the requested period", async () => {
  const requestedPeriods: string[] = [];
  const repository: PersonSettlementsRepository = {
    findPersonForUser: async () => ({
      id: personId,
      name: "Camila",
      role: "external",
      status: "active",
    }),
    listExternalPeopleForUser: async () => [],
    listBalanceEntriesForPerson: async (_personId, _userId, requestedPeriod) => {
      requestedPeriods.push(requestedPeriod);
      return [
        { kind: "expense", amount: "120.00" },
        { kind: "refund", amount: "20.00" },
      ];
    },
    listSettlementsForPerson: async (_personId, _userId, requestedPeriod) => {
      requestedPeriods.push(requestedPeriod);
      return [settlement];
    },
    listRecurringBalanceRulesForPeriod: async () => [],
    createSettlement: async () => null,
    deleteSettlementForUser: async () => null,
  };
  const service = createPersonSettlementsService(repository);

  const snapshot = await service.getSnapshot(personId, userId, period);

  assert.deepEqual(requestedPeriods, [period, period]);
  assert.equal(snapshot.period, period);
  assert.equal(snapshot.balance.assignedAmount, 120);
  assert.equal(snapshot.balance.refundedAmount, 20);
  assert.equal(snapshot.balance.settledAmount, 50);
  assert.equal(snapshot.balance.receivableAmount, 50);
  assert.deepEqual(
    snapshot.settlements.map((item) => item.id),
    [settlement.id],
  );
  assert.equal(snapshot.settlements[0]?.source, "manual");
});

test("registers a manual settlement without a financial account", async () => {
  let createdInput: Parameters<PersonSettlementsRepository["createSettlement"]>[0] | undefined;
  const repository: PersonSettlementsRepository = {
    findPersonForUser: async () => ({
      id: personId,
      name: "Camila",
      role: "external",
      status: "active",
    }),
    listExternalPeopleForUser: async () => [],
    listBalanceEntriesForPerson: async () => [],
    listSettlementsForPerson: async () => [],
    listRecurringBalanceRulesForPeriod: async () => [],
    createSettlement: async (input) => {
      createdInput = input;
      return settlement;
    },
    deleteSettlementForUser: async () => null,
  };

  const created = await createPersonSettlementsService(repository).create(
    {
      personId,
      amount: 50,
      receivedAt: "2026-08-15",
      note: null,
    },
    userId,
  );

  assert.equal(created.source, "manual");
  assert.equal(createdInput?.amount, "50.00");
  assert.equal(createdInput ? "accountId" in createdInput : true, false);
});

test("includes the person's recurring allocation in the requested period", async () => {
  const repository: PersonSettlementsRepository = {
    findPersonForUser: async () => ({
      id: personId,
      name: "Camila",
      role: "external",
      status: "active",
    }),
    listExternalPeopleForUser: async () => [],
    listBalanceEntriesForPerson: async () => [],
    listSettlementsForPerson: async () => [],
    listRecurringBalanceRulesForPeriod: async () => [
      {
        id: "00000000-0000-4000-8000-000000000010",
        seriesId: "00000000-0000-4000-8000-000000000011",
        personId: "00000000-0000-4000-8000-000000000012",
        amount: "-300.00",
        startDate: "2026-08-05",
        endDate: null,
        frequency: "monthly",
        splits: [
          { personId: "00000000-0000-4000-8000-000000000012", amount: "-180.00" },
          { personId, amount: "-120.00" },
        ],
      },
    ],
    createSettlement: async () => null,
    deleteSettlementForUser: async () => null,
  };

  const snapshot = await createPersonSettlementsService(repository).getSnapshot(
    personId,
    userId,
    period,
  );

  assert.equal(snapshot.balance.assignedAmount, 120);
  assert.equal(snapshot.balance.receivableAmount, 120);
});

test("summarizes outstanding balances by person and sorts the largest first", async () => {
  const secondPersonId = "00000000-0000-4000-8000-000000000020";
  const repository: PersonSettlementsRepository = {
    findPersonForUser: async () => null,
    listExternalPeopleForUser: async () => [
      {
        id: personId,
        name: "Camila",
        avatarUrl: null,
        role: "external",
        status: "active",
      },
      {
        id: secondPersonId,
        name: "Bruno",
        avatarUrl: "/avatars/4825015.png",
        role: "external",
        status: "inactive",
      },
    ],
    listBalanceEntriesForPerson: async (requestedPersonId) =>
      requestedPersonId === personId
        ? [{ kind: "expense", amount: "100.00" }]
        : [{ kind: "expense", amount: "40.00" }],
    listSettlementsForPerson: async (requestedPersonId) =>
      requestedPersonId === personId
        ? []
        : [{ ...settlement, personId: secondPersonId, amount: "90.00" }],
    listRecurringBalanceRulesForPeriod: async () => [],
    createSettlement: async () => null,
    deleteSettlementForUser: async () => null,
  };

  const summary = await createPersonSettlementsService(repository).getSummary(userId, period);

  assert.equal(summary.totalReceivableAmount, 100);
  assert.equal(summary.totalCreditAmount, 50);
  assert.deepEqual(
    summary.items.map((item) => [item.personName, item.balance.status]),
    [
      ["Camila", "receivable"],
      ["Bruno", "credit"],
    ],
  );
  assert.equal(summary.items[1]?.personStatus, "inactive");
});
