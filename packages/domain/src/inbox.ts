export const inboxItemStatuses = ["pending", "processed", "discarded"] as const;

export type InboxItemStatus = (typeof inboxItemStatuses)[number];

export const inboxSourceAppMaximumLength = 255;
export const inboxSourceAppNameMaximumLength = 255;
export const inboxOriginalTitleMaximumLength = 500;
export const inboxOriginalTextMaximumLength = 2_000;
export const inboxParsedNameMaximumLength = 160;
export const inboxClientIdMaximumLength = 255;
export const inboxBatchMaximumSize = 50;
export const inboxMaximumPastAgeDays = 365;
export const inboxMaximumFutureSkewMinutes = 10;

export type InboxTransitionCode =
  | "inbox_item_already_processed"
  | "inbox_item_already_pending"
  | "inbox_item_invalid_transition";

export class InboxTransitionError extends Error {
  readonly code: InboxTransitionCode;

  constructor(code: InboxTransitionCode, message: string) {
    super(message);
    this.name = "InboxTransitionError";
    this.code = code;
  }
}

export function assertInboxItemTransition(
  currentStatus: InboxItemStatus,
  targetStatus: InboxItemStatus,
) {
  if (currentStatus === targetStatus) {
    throw new InboxTransitionError(
      targetStatus === "processed"
        ? "inbox_item_already_processed"
        : targetStatus === "pending"
          ? "inbox_item_already_pending"
          : "inbox_item_invalid_transition",
      "The inbox item is already in the requested state",
    );
  }

  const allowed =
    (currentStatus === "pending" && ["processed", "discarded"].includes(targetStatus)) ||
    (currentStatus === "discarded" && targetStatus === "pending");

  if (!allowed) {
    throw new InboxTransitionError(
      "inbox_item_invalid_transition",
      "The inbox item cannot move to the requested state",
    );
  }
}

export function normalizeInboxSingleLine(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

const inboxSourceGenericWords = new Set(["app", "banco", "bank", "cartao", "card", "conta"]);

export function getInboxSourceNameMatchScore(sourceName: string, entityName: string) {
  const sourceKey = getInboxSourceMatchKey(sourceName);
  const entityKey = getInboxSourceMatchKey(entityName);
  if (!sourceKey || !entityKey) return 0;
  if (sourceKey === entityKey) return 2;

  const shortestLength = Math.min(sourceKey.length, entityKey.length);
  if (shortestLength >= 3 && (sourceKey.includes(entityKey) || entityKey.includes(sourceKey))) {
    return 1;
  }

  return 0;
}

export type InboxSummarySource = {
  id: string;
  kind: "account" | "card";
  logo: string | null;
  name: string;
};

export function summarizePendingInboxBySource(
  items: Array<{ sourceAppName: string | null; amount: number | null }>,
  cards: Array<{ id: string; name: string; logo: string | null }>,
  accounts: Array<{ id: string; name: string; logo: string | null }>,
) {
  const summaries = new Map<
    string,
    {
      amountCents: number;
      count: number;
      source: InboxSummarySource;
    }
  >();
  let totalAmountCents = 0;
  let unidentifiedAmountCents = 0;
  let unidentifiedCount = 0;

  for (const item of items) {
    const amountCents =
      item.amount !== null && Number.isFinite(item.amount) ? Math.round(item.amount * 100) : 0;
    totalAmountCents += amountCents;
    const source = findInboxSourceMatch(item.sourceAppName, cards, accounts);

    if (!source) {
      unidentifiedAmountCents += amountCents;
      unidentifiedCount += 1;
      continue;
    }

    const summaryKey = `${source.kind}:${source.id}`;
    const current = summaries.get(summaryKey) ?? {
      amountCents: 0,
      count: 0,
      source,
    };
    current.amountCents += amountCents;
    current.count += 1;
    summaries.set(summaryKey, current);
  }

  return {
    totalAmount: totalAmountCents / 100,
    pendingCount: items.length,
    sources: [...summaries.values()]
      .map(({ amountCents, source, ...summary }) => ({
        ...source,
        ...summary,
        amount: amountCents / 100,
      }))
      .sort((left, right) => right.amount - left.amount || left.name.localeCompare(right.name)),
    unidentifiedAmount: unidentifiedAmountCents / 100,
    unidentifiedCount,
  };
}

function findInboxSourceMatch<T extends { id: string; logo: string | null; name: string }>(
  sourceAppName: string | null,
  cards: T[],
  accounts: T[],
): InboxSummarySource | null {
  if (!sourceAppName) return null;

  const cardMatch = findBestInboxSourceMatch(sourceAppName, cards);
  const accountMatch = findBestInboxSourceMatch(sourceAppName, accounts);
  if (cardMatch.score === 0 && accountMatch.score === 0) return null;

  const kind = cardMatch.score >= accountMatch.score && cardMatch.entity ? "card" : "account";
  const entity = kind === "card" ? cardMatch.entity : accountMatch.entity;
  return entity ? { id: entity.id, kind, logo: entity.logo, name: entity.name } : null;
}

function findBestInboxSourceMatch<T extends { name: string }>(sourceName: string, entities: T[]) {
  return entities.reduce<{ entity: T | null; score: number }>(
    (best, entity) => {
      const score = getInboxSourceNameMatchScore(sourceName, entity.name);
      return score > best.score ? { entity, score } : best;
    },
    { entity: null, score: 0 },
  );
}

function getInboxSourceMatchKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !inboxSourceGenericWords.has(word))
    .join(" ");
}

export function isInboxNotificationTimestampAllowed(timestamp: Date, now = new Date()) {
  if (Number.isNaN(timestamp.getTime())) return false;

  const age = now.getTime() - timestamp.getTime();
  const maximumPastAge = inboxMaximumPastAgeDays * 24 * 60 * 60 * 1_000;
  const maximumFutureSkew = inboxMaximumFutureSkewMinutes * 60 * 1_000;

  return age <= maximumPastAge && age >= -maximumFutureSkew;
}
