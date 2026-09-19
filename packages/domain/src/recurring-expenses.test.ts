import assert from "node:assert/strict";
import test from "node:test";
import { getRecurringDueDate } from "./recurring-expenses";

test("recurring due dates preserve the configured day and clamp short months", () => {
  assert.equal(getRecurringDueDate("2026-01-15", "2026-02-03"), "2026-02-15");
  assert.equal(getRecurringDueDate("2026-01-31", "2026-02-03"), "2026-02-28");
  assert.equal(getRecurringDueDate("2026-01-31", "2024-02-03"), "2024-02-29");
  assert.equal(getRecurringDueDate(null, "2026-02-03"), null);
});
