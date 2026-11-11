import assert from "node:assert/strict";
import test from "node:test";
import { fromCents, roundToTwoDecimals, toCents } from "./money";

test("rounds half-cent values up as written despite binary floating point", () => {
  assert.equal(roundToTwoDecimals(1.005), 1.01);
  assert.equal(roundToTwoDecimals(0.1 + 0.2), 0.3);
  assert.equal(roundToTwoDecimals(33.333), 33.33);
  assert.equal(roundToTwoDecimals(-2.5), -2.5);
});

test("converts between amounts and cents", () => {
  assert.equal(toCents(10.1), 1010);
  assert.equal(fromCents(1010), 10.1);
});
