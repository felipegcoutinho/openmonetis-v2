import assert from "node:assert/strict";
import test from "node:test";
import { ListCategoryTrendsQuerySchema } from "@openmonetis/validators/category-trends";
import { createCategoryTrendsService } from "./category-trends.service";

for (const scope of [undefined, "admin", "all", "80000000-0000-4000-8000-000000000008"] as const) {
  test(`category summary forwards ${scope ?? "default"} scope to actual and recurring queries`, async () => {
    const calls: unknown[][] = [];
    const service = createCategoryTrendsService({
      async listCategoriesForUser(userId) {
        assert.equal(userId, "owner");
        return [];
      },
      async listActualEntriesForUser(...args) {
        calls.push(args);
        return [];
      },
      async listRecurringRulesForUser(...args) {
        calls.push(args);
        return [];
      },
    });
    await service.list(
      "owner",
      ListCategoryTrendsQuerySchema.parse({
        startPeriod: "2026-09",
        endPeriod: "2026-09",
        personScope: scope,
      }),
    );
    assert.equal(calls.length, 2);
    for (const args of calls) {
      assert.equal(args[0], "owner");
      assert.equal(args.at(-1), scope ?? "admin");
    }
  });
}

test("category scope rejects unexpected values", () => {
  assert.equal(
    ListCategoryTrendsQuerySchema.safeParse({
      startPeriod: "2026-09",
      endPeriod: "2026-09",
      personScope: "external",
    }).success,
    false,
  );
});

test("invoice reductions lower expense trends without becoming income", async () => {
  const purchaseCategoryId = "10000000-0000-4000-8000-000000000001";
  const adjustmentCategoryId = "20000000-0000-4000-8000-000000000002";
  const service = createCategoryTrendsService({
    async listCategoriesForUser() {
      return [
        { categoryId: purchaseCategoryId, name: "Compras", icon: null, type: "expense" },
        {
          categoryId: adjustmentCategoryId,
          name: "Ajustes de fatura",
          icon: null,
          type: "expense",
        },
      ];
    },
    async listActualEntriesForUser() {
      return [
        {
          categoryId: purchaseCategoryId,
          origin: "regular" as const,
          transactionType: "expense" as const,
          type: "expense" as const,
          period: "2026-09",
          amount: "-100.00",
        },
        {
          categoryId: adjustmentCategoryId,
          origin: "invoiceAdjustment" as const,
          transactionType: "expense" as const,
          type: "expense" as const,
          period: "2026-09",
          amount: "20.00",
        },
      ];
    },
    async listRecurringRulesForUser() {
      return [];
    },
  });

  const report = await service.list(
    "owner",
    ListCategoryTrendsQuerySchema.parse({ startPeriod: "2026-09", endPeriod: "2026-09" }),
  );

  assert.equal(report.summary.incomeAmount, 0);
  assert.equal(report.summary.expenseAmount, 80);
  assert.equal(
    report.categories.find((category) => category.categoryId === adjustmentCategoryId)?.totalAmount,
    -20,
  );
});
