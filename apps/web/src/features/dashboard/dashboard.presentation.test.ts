import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardWidgetPreferences } from "@openmonetis/domain/dashboard";
import {
  formatMetricChangePercent,
  hideDashboardWidget,
  moveDashboardWidget,
  showDashboardWidget,
} from "./dashboard.presentation";

const preferences: DashboardWidgetPreferences = {
  hidden: [],
  order: ["attention", "accounts", "invoices", "bills", "budgets"],
};

test("moving a widget down lands after the target and up lands before it", () => {
  assert.deepEqual(moveDashboardWidget(preferences, "accounts", "bills").order, [
    "attention",
    "invoices",
    "bills",
    "accounts",
    "budgets",
  ]);
  assert.deepEqual(moveDashboardWidget(preferences, "bills", "accounts").order, [
    "attention",
    "bills",
    "accounts",
    "invoices",
    "budgets",
  ]);
});

test("moving onto itself or an unknown widget keeps the order", () => {
  assert.equal(moveDashboardWidget(preferences, "bills", "bills"), preferences);
  assert.equal(moveDashboardWidget(preferences, "bills", "notes"), preferences);
});

test("an added widget appears after the last visible widget of its section", () => {
  const withHiddenAccounts = hideDashboardWidget(preferences, "accounts");

  assert.deepEqual(
    showDashboardWidget(withHiddenAccounts, "accounts", ["accounts", "invoices", "bills"]),
    { hidden: [], order: ["attention", "invoices", "bills", "accounts", "budgets"] },
  );
});

test("an added widget keeps its position when its section has nothing visible", () => {
  const allHidden: DashboardWidgetPreferences = { ...preferences, hidden: ["invoices", "bills"] };

  assert.deepEqual(showDashboardWidget(allHidden, "bills", ["invoices", "bills"]), {
    hidden: ["invoices"],
    order: preferences.order,
  });
});

test("hiding or showing twice keeps the preferences", () => {
  const hidden = hideDashboardWidget(preferences, "bills");

  assert.equal(hideDashboardWidget(hidden, "bills"), hidden);
  assert.equal(showDashboardWidget(preferences, "bills", ["bills"]), preferences);
});

test("metric change percent shows the sign only when there is a change", () => {
  assert.equal(formatMetricChangePercent(6), "+6%");
  assert.equal(formatMetricChangePercent(-12), "-12%");
  assert.equal(formatMetricChangePercent(0), "0%");
});
