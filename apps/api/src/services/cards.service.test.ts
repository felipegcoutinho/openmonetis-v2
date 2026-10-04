import assert from "node:assert/strict";
import { test } from "node:test";
import { CreateCardInputSchema, UpdateCardInputSchema } from "@openmonetis/validators/cards";
import { type CardsRepository, createCardsService } from "./cards.service";

test("card option is validated and partial updates do not reset an omitted option", () => {
  assert.deepEqual(UpdateCardInputSchema.parse({ name: "Principal" }), { name: "Principal" });
  assert.deepEqual(UpdateCardInputSchema.parse({ closingDayPurchasesNextInvoice: false }), {
    closingDayPurchasesNextInvoice: false,
  });
  for (const value of ["true", "false", 1, null]) {
    assert.equal(
      UpdateCardInputSchema.safeParse({ closingDayPurchasesNextInvoice: value }).success,
      false,
    );
  }
});

test("card writes persist the option and preserve recorded invoice periods when toggled", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const userId = "user-1";
  const input = CreateCardInputSchema.parse({
    accountId: "22222222-2222-4222-8222-222222222222",
    name: "Principal",
    brand: "visa",
    closingDay: 5,
    dueDay: 10,
    limit: 1000,
  });
  let stored: Awaited<ReturnType<CardsRepository["findByIdForUser"]>> = null;
  const recordedMovements = [
    { cardId: id, period: "2026-10", purchaseDate: "2026-10-05", amount: "-100.00" },
  ];
  const repository: CardsRepository = {
    accountExistsForUser: async (accountId, ownerId) =>
      accountId === input.accountId && ownerId === userId,
    insert: async (data) => {
      stored = {
        ...data,
        id,
        createdAt: new Date("2026-01-01"),
        updatedAt: new Date("2026-01-01"),
      };
      return stored;
    },
    updateForUser: async (cardId, ownerId, data) => {
      if (!stored || stored.id !== cardId || stored.userId !== ownerId) return null;
      stored = { ...stored, ...data };
      return stored;
    },
    findByIdForUser: async (cardId, ownerId) =>
      stored?.id === cardId && stored.userId === ownerId ? stored : null,
    listByUser: async () => (stored ? [stored] : []),
    deleteInactiveForUser: async () => ({ status: "not_found" }),
    listMovementsByUser: async () => recordedMovements,
    listInvoiceStatesByUser: async () => [],
    listInvoicePaymentsByUser: async () => [],
    listActiveRecurringRulesThroughPeriod: async () => [],
  };
  const service = createCardsService(repository, () => "2026-10-05");
  assert.equal((await service.create(input, userId)).closingDayPurchasesNextInvoice, false);
  assert.deepEqual(await service.quoteInvoicePeriod(id, userId, "2026-10-05"), {
    period: "2026-10",
  });
  await assert.rejects(
    service.update(id, "another-user", { closingDayPurchasesNextInvoice: true }),
  );
  await assert.rejects(service.quoteInvoicePeriod(id, "another-user", "2026-10-05"));
  assert.equal(
    (await service.update(id, userId, { closingDayPurchasesNextInvoice: true }))
      .closingDayPurchasesNextInvoice,
    true,
  );
  assert.deepEqual(await service.quoteInvoicePeriod(id, userId, "2026-10-05"), {
    period: "2026-11",
  });
  const october = await service.get(id, userId, "2026-10");
  assert.equal(october.invoiceSummary.amount, 100);
  assert.equal(october.invoiceSummary.closingDate, "2026-10-04");
  assert.equal(october.invoiceSummary.status, "closed");
  assert.equal((await service.get(id, userId, "2026-11")).invoiceSummary.amount, 0);
  assert.equal(recordedMovements[0]?.period, "2026-10");
  assert.equal(
    (await service.update(id, userId, { name: "Renomeado" })).closingDayPurchasesNextInvoice,
    true,
  );
  assert.equal(
    (await service.replace(id, userId, { ...input, closingDayPurchasesNextInvoice: false }))
      .closingDayPurchasesNextInvoice,
    false,
  );
  assert.equal(
    (await service.replace(id, userId, { ...input, closingDayPurchasesNextInvoice: true }))
      .closingDayPurchasesNextInvoice,
    true,
  );
  assert.equal(
    (await service.update(id, userId, { closingDayPurchasesNextInvoice: false }))
      .closingDayPurchasesNextInvoice,
    false,
  );
  assert.deepEqual(await service.quoteInvoicePeriod(id, userId, "2026-10-05"), {
    period: "2026-10",
  });
  assert.equal(
    (await service.create({ ...input, closingDayPurchasesNextInvoice: true }, userId))
      .closingDayPurchasesNextInvoice,
    true,
  );
});

test("card cycle spending includes recurring purchases on their day in the selected invoice", async () => {
  const cardId = "11111111-1111-4111-8111-111111111111";
  const card = {
    id: cardId,
    userId: "user-1",
    accountId: "22222222-2222-4222-8222-222222222222",
    name: "Principal",
    brand: "visa" as const,
    status: "active" as const,
    closingDay: 20,
    closingRuleType: "fixedDay" as const,
    closingOffsetDays: null,
    closingOffsetMode: null,
    closingDayPurchasesNextInvoice: false,
    dueDay: 10,
    limit: "1000.00",
    logo: null,
    note: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };
  const repository: CardsRepository = {
    accountExistsForUser: async () => true,
    insert: async () => card,
    deleteInactiveForUser: async () => ({ status: "not_found" }),
    listByUser: async () => [card],
    findByIdForUser: async (id, userId) => (id === cardId && userId === card.userId ? card : null),
    updateForUser: async () => card,
    listMovementsByUser: async () => [
      { cardId, period: "2026-04", amount: "-20.00", purchaseDate: "2026-03-08" },
      { cardId, period: "2026-04", amount: "-10.00", purchaseDate: "2026-01-05" },
    ],
    listInvoiceStatesByUser: async () => [],
    listInvoicePaymentsByUser: async () => [],
    listActiveRecurringRulesThroughPeriod: async () => [
      {
        id: "33333333-3333-4333-8333-333333333333",
        cardId,
        amount: "-50.00",
        anchorDate: "2026-01-05",
        startDate: "2026-01-05",
        endDate: null,
        frequency: "monthly",
        paymentMethod: "credit_card",
        dueDate: null,
        closingDay: 20,
        closingRuleType: "fixedDay",
        closingOffsetDays: null,
        closingOffsetMode: null,
        closingDayPurchasesNextInvoice: false,
        dueDay: 10,
      },
    ],
  };

  const service = createCardsService(repository, () => "2026-04-15");
  const result = await service.get(cardId, "user-1", "2026-04");

  assert.equal(result.cycleSpending.startDate, "2026-02-21");
  assert.equal(result.cycleSpending.endDate, "2026-03-20");
  assert.equal(result.cycleSpending.openingAmount, 10);
  assert.deepEqual(
    result.cycleSpending.daily.filter((day) => day.amount > 0),
    [
      { date: "2026-03-05", amount: 50, cumulativeAmount: 60 },
      { date: "2026-03-08", amount: 20, cumulativeAmount: 80 },
    ],
  );
  assert.equal(result.invoiceSummary.amount, 80);
  assert.equal(result.cycleSpending.daily.at(-1)?.cumulativeAmount, result.invoiceSummary.amount);

  const history = await service.history(cardId, "user-1", "2026-04");
  assert.equal(history.items.length, 12);
  assert.deepEqual(history.items.slice(-3), [
    { period: "2026-02", amount: 50 },
    { period: "2026-03", amount: 50 },
    { period: "2026-04", amount: 80 },
  ]);
  await assert.rejects(service.history(cardId, "another-user", "2026-04"));

  const originalRules = await repository.listActiveRecurringRulesThroughPeriod(
    "user-1",
    new Date("2026-05-31"),
  );
  card.closingDayPurchasesNextInvoice = true;
  repository.listActiveRecurringRulesThroughPeriod = async () =>
    originalRules.map((rule) => ({
      ...rule,
      anchorDate: "2026-03-20",
      startDate: "2026-03-20",
      closingDayPurchasesNextInvoice: true,
    }));
  const april = await service.get(cardId, "user-1", "2026-04");
  const may = await service.get(cardId, "user-1", "2026-05");
  assert.equal(april.invoiceSummary.amount, 30);
  assert.equal(may.invoiceSummary.amount, 50);
  assert.equal(may.cycleSpending.startDate, "2026-03-20");
  assert.equal(may.cycleSpending.endDate, "2026-04-19");
  assert.equal(may.cycleSpending.daily[0]?.amount, 50);
});
