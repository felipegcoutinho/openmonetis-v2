import assert from "node:assert/strict";
import test from "node:test";
import { getPeriodEndDate } from "./transactions";

test("period end uses the final UTC calendar day across month and year boundaries", () => {
  assert.equal(getPeriodEndDate("2026-02").toISOString(), "2026-02-28T00:00:00.000Z");
  assert.equal(getPeriodEndDate("2024-02").toISOString(), "2024-02-29T00:00:00.000Z");
  assert.equal(getPeriodEndDate("2026-12").toISOString(), "2026-12-31T00:00:00.000Z");
});
