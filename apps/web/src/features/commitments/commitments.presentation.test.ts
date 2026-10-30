import assert from "node:assert/strict";
import test from "node:test";
import {
  commitmentStatusLabel,
  formatCommitmentChartPeriod,
  formatCommitmentPercentage,
  formatCommitmentPercentagePointChange,
  resolveCommitmentsSearch,
  validateCommitmentsSearch,
} from "./commitments.presentation";

test("commitments search keeps a valid range and falls back to the default horizon", () => {
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2026-10", endPeriod: "2027-03" }),
    ),
    { startPeriod: "2026-10", endPeriod: "2027-03" },
  );
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2026-10", endPeriod: "bad" }),
    ),
    { startPeriod: "2026-10", endPeriod: "2027-03" },
  );
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2026-10", endPeriod: "2024-01" }),
    ),
    { startPeriod: "2026-10", endPeriod: "2027-03" },
  );
  assert.deepEqual(
    resolveCommitmentsSearch(
      validateCommitmentsSearch({ startPeriod: "2024-01", endPeriod: "2027-12" }),
    ),
    { startPeriod: "2024-01", endPeriod: "2024-06" },
  );
});

test("commitments search accepts the legacy period as the horizon start", () => {
  assert.deepEqual(resolveCommitmentsSearch(validateCommitmentsSearch({ period: "2026-03" })), {
    startPeriod: "2026-03",
    endPeriod: "2026-08",
  });
});

test("commitments labels are in Portuguese", () => {
  assert.equal(formatCommitmentPercentage(null), "—");
  assert.equal(formatCommitmentPercentage(35.1), "35,1%");
  assert.equal(commitmentStatusLabel("attention"), "Atenção");
  assert.match(formatCommitmentChartPeriod("2026-10"), /^Out/);
});

test("commitment change between months is shown in percentage points", () => {
  assert.equal(formatCommitmentPercentagePointChange(72.4, 64.4), "+8 p.p. vs. mês anterior");
  assert.equal(formatCommitmentPercentagePointChange(50, 62.5), "−12,5 p.p. vs. mês anterior");
  assert.equal(formatCommitmentPercentagePointChange(40, 40), "igual ao mês anterior");
  assert.equal(formatCommitmentPercentagePointChange(null, 40), null);
});
