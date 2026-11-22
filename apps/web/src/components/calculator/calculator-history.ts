import { z } from "zod";
import type { CalculatorHistoryResult } from "./calculator-state";

/** Scratch calculations kept only in this browser; never financial data of record. */
export const calculatorHistoryStorageKey = "openmonetis:calculator-history:v1";
export const calculatorHistoryLimit = 20;

const calculatorHistoryEntrySchema = z.object({
  createdAt: z.number().int().nonnegative(),
  expression: z.string().min(1).max(200),
  id: z.string().min(1).max(64),
  result: z.string().regex(/^-?\d+(\.\d+)?(e[-+]\d+)?$/),
});

export type CalculatorHistoryEntry = z.infer<typeof calculatorHistoryEntrySchema>;

const emptyHistory: CalculatorHistoryEntry[] = [];
const listeners = new Set<() => void>();
let cachedHistory: CalculatorHistoryEntry[] | null = null;

export function parseCalculatorHistory(rawValue: string | null): CalculatorHistoryEntry[] {
  if (!rawValue) return emptyHistory;
  try {
    const parsed = z.array(calculatorHistoryEntrySchema).safeParse(JSON.parse(rawValue) as unknown);
    return parsed.success ? parsed.data.slice(0, calculatorHistoryLimit) : emptyHistory;
  } catch {
    return emptyHistory;
  }
}

/** Newest first; repeating the latest calculation does not add a duplicate. */
export function prependCalculatorHistoryEntry(
  entries: CalculatorHistoryEntry[],
  entry: CalculatorHistoryEntry,
): CalculatorHistoryEntry[] {
  const [latest] = entries;
  if (latest && latest.expression === entry.expression && latest.result === entry.result) {
    return entries;
  }
  return [entry, ...entries].slice(0, calculatorHistoryLimit);
}

export function getCalculatorHistorySnapshot(): CalculatorHistoryEntry[] {
  cachedHistory ??= parseCalculatorHistory(readStorage());
  return cachedHistory;
}

export function getCalculatorHistoryServerSnapshot(): CalculatorHistoryEntry[] {
  return emptyHistory;
}

export function subscribeCalculatorHistory(listener: () => void) {
  listeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== calculatorHistoryStorageKey) return;
    cachedHistory = null;
    listener();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function addCalculatorHistoryEntry(result: CalculatorHistoryResult) {
  const entry: CalculatorHistoryEntry = {
    ...result,
    createdAt: Date.now(),
    id: createEntryId(),
  };
  const nextHistory = prependCalculatorHistoryEntry(getCalculatorHistorySnapshot(), entry);
  if (nextHistory === cachedHistory) return;
  commit(nextHistory);
}

export function clearCalculatorHistory() {
  try {
    localStorage.removeItem(calculatorHistoryStorageKey);
  } catch {
    // Storage may be unavailable (private browsing or blocked site data).
  }
  cachedHistory = emptyHistory;
  notify();
}

function commit(nextHistory: CalculatorHistoryEntry[]) {
  try {
    localStorage.setItem(calculatorHistoryStorageKey, JSON.stringify(nextHistory));
  } catch {
    // Keep the history for this page load even when it cannot be saved.
  }
  cachedHistory = nextHistory;
  notify();
}

function readStorage() {
  try {
    return localStorage.getItem(calculatorHistoryStorageKey);
  } catch {
    return null;
  }
}

function notify() {
  for (const listener of listeners) listener();
}

function createEntryId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
