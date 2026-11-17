import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";

export const commandMenuMinimumRemoteSearchLength = 2;
export const commandMenuRemoteSearchDelayMs = 250;
export const commandMenuTransactionResultLimit = 10;
export const commandMenuEntityResultLimit = 5;
const commandMenuTransactionLookbackDays = 365;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function normalizeCommandMenuText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

export function matchesCommandMenuQuery(query: string, ...texts: Array<string | null | undefined>) {
  const normalizedQuery = normalizeCommandMenuText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeCommandMenuText(texts.filter(Boolean).join(" "));
  return normalizedQuery.split(/\s+/).every((term) => haystack.includes(term));
}

export function getCommandMenuTransactionDateRange(today = getCurrentDateInBrazil()) {
  const start = new Date(`${today}T12:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - commandMenuTransactionLookbackDays);
  return { dateStart: start.toISOString().slice(0, 10), dateEnd: today };
}

// Listed ids can be composite: `<transactionId>:<personId>` for a person's share of a split
// transaction, and `<ruleId>:<date>` for a recurring occurrence that was never persisted. Only the
// first kind maps to a transaction the deep link can open; the second is reached through the
// period listing filtered by name.
export function getCommandMenuTransactionEditId(id: string) {
  const [baseId, suffix] = id.split(":");
  if (!baseId || !uuidPattern.test(baseId)) return null;
  if (suffix !== undefined && !uuidPattern.test(suffix)) return null;
  return baseId;
}
