import assert from "node:assert/strict";
import test from "node:test";
import {
  compactInstallmentsSearch,
  resolveInstallmentsSearch,
  validateInstallmentsSearch,
} from "./installments.presentation";

test("installments URL without params resolves to the default list filters", () => {
  assert.deepEqual(resolveInstallmentsSearch(validateInstallmentsSearch({})), {
    card: "all",
    q: "",
  });
});

test("installments URL keeps list filters and drops the legacy month and status", () => {
  const search = validateInstallmentsSearch({
    period: "2026-10",
    status: "completed",
    card: "card-1",
    q: "Notebook",
  });
  assert.equal("period" in search, false);
  assert.equal("status" in search, false);
  assert.deepEqual(resolveInstallmentsSearch(search), {
    card: "card-1",
    q: "Notebook",
  });
});

test("invalid installments filters fall back to defaults and defaults stay out of the URL", () => {
  const search = validateInstallmentsSearch({ card: "", q: ["wrong"] });
  assert.deepEqual(resolveInstallmentsSearch(search), { card: "all", q: "" });
  assert.deepEqual(compactInstallmentsSearch({ card: "all", q: "" }), {
    card: undefined,
    q: undefined,
  });
});
