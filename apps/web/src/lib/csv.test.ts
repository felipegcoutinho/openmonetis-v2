import assert from "node:assert/strict";
import test from "node:test";
import { csvCell } from "./csv";

test("CSV cells are quoted and escape embedded quotes", () => {
  assert.equal(csvCell("Mercado"), '"Mercado"');
  assert.equal(csvCell('Casa; "Aluguel"'), '"Casa; ""Aluguel"""');
  assert.equal(csvCell(""), '""');
});

test("formula-like text is neutralized before reaching a spreadsheet", () => {
  for (const value of [
    '=HYPERLINK("https://example.test")',
    "+1+1",
    "@SUM(A1)",
    "-2+3",
    "  =1",
    "\t=1",
    "\r=1",
    "\n=1",
  ]) {
    assert.equal(csvCell(value), `"'${value.replaceAll('"', '""')}"`, value);
  }
});

test("signed PT-BR amounts stay numeric", () => {
  assert.equal(csvCell("-10,05"), '"-10,05"');
  assert.equal(csvCell("-12"), '"-12"');
  assert.equal(csvCell("10,05"), '"10,05"');
});
