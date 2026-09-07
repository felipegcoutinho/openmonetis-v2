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
