import { useSyncExternalStore } from "react";
import {
  addCalculatorHistoryEntry,
  clearCalculatorHistory,
  getCalculatorHistoryServerSnapshot,
  getCalculatorHistorySnapshot,
  subscribeCalculatorHistory,
} from "./calculator-history";

export function useCalculatorHistory() {
  const entries = useSyncExternalStore(
    subscribeCalculatorHistory,
    getCalculatorHistorySnapshot,
    getCalculatorHistoryServerSnapshot,
  );
  return { addEntry: addCalculatorHistoryEntry, clear: clearCalculatorHistory, entries };
}
