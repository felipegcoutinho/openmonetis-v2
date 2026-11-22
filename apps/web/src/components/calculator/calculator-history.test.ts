import assert from "node:assert/strict";
import test from "node:test";
import {
  type CalculatorHistoryEntry,
  calculatorHistoryLimit,
  parseCalculatorHistory,
  prependCalculatorHistoryEntry,
} from "./calculator-history";
import {
  calculatorReducer,
  createCalculatorState,
  getCalculatorExpression,
  getCalculatorPendingResult,
} from "./calculator-state";

function entry(id: number, expression = `${id} + 1`, result = String(id + 1)) {
  return { createdAt: id, expression, id: `entry-${id}`, result } satisfies CalculatorHistoryEntry;
}

test("the pending result matches what equals produces", () => {
  let state = createCalculatorState("1250.5");
  state = calculatorReducer(state, { type: "operator", operator: "multiply" });
  state = calculatorReducer(state, { type: "digit", digit: "3" });

  const pending = getCalculatorPendingResult(state);
  const evaluated = calculatorReducer(state, { type: "equals" });

  assert.deepEqual(pending, { expression: "1.250,5 × 3", result: "3751.5" });
  assert.equal(evaluated.display, pending?.result);
  assert.equal(evaluated.lastExpression, pending?.expression);
});

test("there is no pending result without an operation or when it fails", () => {
  assert.equal(getCalculatorPendingResult(createCalculatorState("42")), null);

  let state = createCalculatorState("8");
  state = calculatorReducer(state, { type: "operator", operator: "divide" });
  state = calculatorReducer(state, { type: "digit", digit: "0" });
  assert.equal(getCalculatorPendingResult(state), null);
  assert.equal(calculatorReducer(state, { type: "equals" }).display, "Erro");
});

test("recalling an entry shows its result and lets the next operation continue from it", () => {
  let state = calculatorReducer(createCalculatorState(), {
    type: "recall",
    entry: { expression: "10 ÷ 3", result: "3.3333333333" },
  });
  assert.equal(getCalculatorExpression(state), "3,3333333333");
  assert.equal(state.lastExpression, "10 ÷ 3");

  state = calculatorReducer(state, { type: "operator", operator: "add" });
  state = calculatorReducer(state, { type: "digit", digit: "1" });
  assert.equal(calculatorReducer(state, { type: "equals" }).display, "4.3333333333");
});

test("typing after a recalled entry starts a new number", () => {
  let state = calculatorReducer(createCalculatorState(), {
    type: "recall",
    entry: { expression: "2 + 2", result: "4" },
  });
  state = calculatorReducer(state, { type: "digit", digit: "7" });
  assert.equal(state.display, "7");
  assert.equal(state.lastExpression, null);
});

test("new entries go first, the list is capped and repeats are skipped", () => {
  let history: CalculatorHistoryEntry[] = [];
  for (let index = 0; index < calculatorHistoryLimit + 5; index += 1) {
    history = prependCalculatorHistoryEntry(history, entry(index));
  }

  assert.equal(history.length, calculatorHistoryLimit);
  assert.equal(history[0]?.id, `entry-${calculatorHistoryLimit + 4}`);

  const repeated = { ...entry(999, history[0]?.expression, history[0]?.result) };
  assert.equal(prependCalculatorHistoryEntry(history, repeated), history);
});

test("stored history is read back and invalid data is discarded", () => {
  const stored = [entry(2), entry(1)];
  assert.deepEqual(parseCalculatorHistory(JSON.stringify(stored)), stored);

  assert.deepEqual(parseCalculatorHistory(null), []);
  assert.deepEqual(parseCalculatorHistory("{not json"), []);
  assert.deepEqual(parseCalculatorHistory(JSON.stringify({ entries: stored })), []);
  assert.deepEqual(
    parseCalculatorHistory(JSON.stringify([{ ...entry(1), result: "<script>" }])),
    [],
  );
});
