import assert from "node:assert/strict";
import test from "node:test";
import {
  getCommandMenuTransactionDateRange,
  getCommandMenuTransactionEditId,
  matchesCommandMenuQuery,
  normalizeCommandMenuText,
} from "./command-menu-search";

test("normalizes accents and case for command menu search", () => {
  assert.equal(normalizeCommandMenuText("  Anotações  "), "anotacoes");
});

test("matches every typed term against the combined texts", () => {
  assert.equal(matchesCommandMenuQuery("", "Contas"), true);
  assert.equal(matchesCommandMenuQuery("nova desp", "Nova despesa", "gasto"), true);
  assert.equal(matchesCommandMenuQuery("cart fatura", "Cartões", "Faturas e limites"), true);
  assert.equal(matchesCommandMenuQuery("receita", "Nova despesa", null), false);
});

test("searches transactions over the last year up to today", () => {
  assert.deepEqual(getCommandMenuTransactionDateRange("2026-03-01"), {
    dateStart: "2025-03-01",
    dateEnd: "2026-03-01",
  });
});

test("opens persisted transactions and split shares by their base id", () => {
  const id = "3f6d2b84-6ed0-4a50-b257-8adf0b6178de";
  const personId = "9a1c7f20-1b2d-4c3e-8f40-5a6b7c8d9e0f";
  assert.equal(getCommandMenuTransactionEditId(id), id);
  assert.equal(getCommandMenuTransactionEditId(`${id}:${personId}`), id);
  assert.equal(getCommandMenuTransactionEditId(`${id}:2026-07-07`), null);
});
