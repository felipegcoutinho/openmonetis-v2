import assert from "node:assert/strict";
import test from "node:test";
import {
  formatInboxTimestamp,
  getInboxPurchaseDate,
  groupInboxItemsByDate,
} from "./inbox.presentation";

const baseItem = {
  id: "00000000-0000-4000-8000-000000000001",
  sourceAppName: "Banco Example",
  originalText: "Compra aprovada",
  parsedName: "Compra",
  parsedAmount: 10,
  status: "pending" as const,
  transactionId: null,
  processedAt: null,
  discardedAt: null,
  createdAt: "2026-08-18T03:05:00.000Z",
  updatedAt: "2026-08-18T03:05:00.000Z",
};

test("inbox purchases use the Sao Paulo calendar date around the UTC day boundary", () => {
  const simulations = [
    { timestamp: "2026-08-17T23:30:00.000Z", expectedDate: "2026-08-17" },
    { timestamp: "2026-08-18T00:30:00.000Z", expectedDate: "2026-08-17" },
    { timestamp: "2026-08-18T02:59:00.000Z", expectedDate: "2026-08-17" },
    { timestamp: "2026-08-18T03:01:00.000Z", expectedDate: "2026-08-18" },
  ];

  for (const simulation of simulations) {
    assert.equal(getInboxPurchaseDate(simulation.timestamp), simulation.expectedDate);
  }
});

test("inbox grouping and purchase defaults agree on the local purchase date", () => {
  const notificationTimestamp = "2026-08-18T00:30:00.000Z";
  const [group] = groupInboxItemsByDate(
    [{ ...baseItem, notificationTimestamp }],
    new Date("2026-08-18T12:00:00.000Z"),
  );

  assert.equal(group?.dateKey, "2026-08-17");
  assert.equal(getInboxPurchaseDate(notificationTimestamp), group?.dateKey);
});

test("inbox widget formats timestamps in Sao Paulo time", () => {
  const formatted = formatInboxTimestamp("2026-08-18T00:30:00.000Z");

  assert.match(formatted, /17/);
  assert.match(formatted, /21:30/);
  assert.doesNotMatch(formatted, /18/);
});
