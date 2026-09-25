import assert from "node:assert/strict";
import test from "node:test";
import { calculateOpenBillsTotal } from "./bills";

test("open bills total rounds fractional cents after excluding settled bills", () => {
  assert.equal(
    calculateOpenBillsTotal([
      { amount: 0.1, isSettled: false },
      { amount: 0.2, isSettled: false },
      { amount: 99.99, isSettled: true },
    ]),
    0.3,
  );
  assert.equal(calculateOpenBillsTotal([]), 0);
});
