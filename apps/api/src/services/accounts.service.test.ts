import assert from "node:assert/strict";
import test from "node:test";
import type { AccountsRepository } from "./accounts.service";
import { createAccountsService } from "./accounts.service";

const userId = "10000000-0000-4000-8000-000000000001";
const accountId = "20000000-0000-4000-8000-000000000002";

const account = {
  id: accountId,
  userId,
  name: "Conta principal",
  type: "checking",
  logo: null,
  note: null,
  excludeFromBalance: false,
  isArchived: false,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
} as const;

function createRepository(overrides: Partial<AccountsRepository> = {}): AccountsRepository {
  return new Proxy(
    {
      listByUser: async () => [account],
      listSettledAccountPostingsThroughPeriod: async () => [],
      listAccountRecurringRulesThroughPeriod: async () => [],
      listRecurringOccurrenceStatesThroughPeriod: async () => [],
      ...overrides,
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected repository call: ${String(property)}`);
        };
      },
    },
  ) as AccountsRepository;
}

test("paid boleto affects the account in the payment month, not the due month", async () => {
  const service = createAccountsService(
    createRepository({
      listSettledAccountPostingsThroughPeriod: async () => [
        {
          accountId,
          period: "2026-09",
          paymentMethod: "boleto",
          boletoPaymentDate: "2026-08-31",
          amount: "-100.00",
        },
      ],
    }),
  );

  const [august, september] = await Promise.all([
    service.list(userId, "2026-08"),
    service.list(userId, "2026-09"),
  ]);

  assert.deepEqual(august[0]?.summary, {
    period: "2026-08",
    income: 0,
    expenses: 100,
    balance: -100,
  });
  assert.deepEqual(september[0]?.summary, {
    period: "2026-09",
    income: 0,
    expenses: 0,
    balance: -100,
  });
});

test("early recurring boleto payment is posted before its occurrence due month", async () => {
  const recurringRuleId = "30000000-0000-4000-8000-000000000003";
  const service = createAccountsService(
    createRepository({
      listAccountRecurringRulesThroughPeriod: async () => [
        {
          id: recurringRuleId,
          accountId,
          sourceAccountId: null,
          destinationAccountId: null,
          amount: "-250.00",
          type: "expense",
          paymentMethod: "boleto",
          startDate: "2026-09-01",
          endDate: null,
          dueDate: "2026-09-03",
          frequency: "monthly",
          isSettled: false,
        },
      ],
      listRecurringOccurrenceStatesThroughPeriod: async () => [
        {
          recurringRuleId,
          purchaseDate: "2026-09-01",
          isSettled: true,
          accountId,
          boletoPaymentDate: "2026-08-29",
        },
      ],
    }),
  );

  const result = await service.list(userId, "2026-08");

  assert.deepEqual(result[0]?.summary, {
    period: "2026-08",
    income: 0,
    expenses: 250,
    balance: -250,
  });
});
