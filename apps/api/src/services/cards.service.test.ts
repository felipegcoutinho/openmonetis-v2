import assert from "node:assert/strict";
import { test } from "node:test";
import { type CardsRepository, createCardsService } from "./cards.service";

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
});
