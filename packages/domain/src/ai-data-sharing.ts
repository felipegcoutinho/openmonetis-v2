/**
 * What a person allows the AI diagnosis to send beyond the aggregates that are always shared
 * (monthly totals, indicators, category amounts and attention counts). Nothing is allowed by
 * default.
 */
export const aiDataScopes = [
  "categoryNames",
  "transactions",
  "people",
  "notes",
  "accounts",
  "budgetsAndGoals",
] as const;
export type AiDataScope = (typeof aiDataScopes)[number];

/** These only describe transactions, so they are meaningless without them. */
export const aiDataScopesRequiringTransactions: readonly AiDataScope[] = ["people", "notes"];

/**
 * How long AI chats and diagnoses are kept, in days since their last activity. `null` keeps them
 * until the person deletes them; new and existing people start with the default.
 */
export const aiDataRetentionDaysOptions = [30, 90, 365] as const;
export type AiDataRetentionDays = (typeof aiDataRetentionDaysOptions)[number] | null;
export const defaultAiDataRetentionDays = 90 satisfies AiDataRetentionDays;

const dayMs = 24 * 60 * 60 * 1000;

/** Anything last active before this instant is past its retention. */
export function aiDataRetentionCutoff(now: Date, days: number) {
  return new Date(now.getTime() - days * dayMs);
}

/** Upper bound of transactions sent per diagnosis, most recent first. */
export const aiDiagnosisTransactionsLimit = 300;

/** Canonical, de-duplicated scopes without the ones whose prerequisite is missing. */
export function normalizeAiDataScopes(scopes: readonly AiDataScope[]): AiDataScope[] {
  const allowed = new Set(scopes);
  return aiDataScopes.filter(
    (scope) =>
      allowed.has(scope) &&
      (!aiDataScopesRequiringTransactions.includes(scope) || allowed.has("transactions")),
  );
}

export function isFullAiDataSharing(scopes: readonly AiDataScope[]) {
  return normalizeAiDataScopes(scopes).length === aiDataScopes.length;
}

const aliasPrefix = "Categoria";
const aliasPattern = new RegExp(`\\b${aliasPrefix} (\\d{1,4})\\b`, "g");
/** A suffix that may still grow into a placeholder ("Cat", "Categoria ", "Categoria 1"). */
const partialAliasPattern = /\bC(?:a(?:t(?:e(?:g(?:o(?:r(?:i(?:a(?: \d{0,4})?)?)?)?)?)?)?)?)?$/;

/**
 * Replaces category names with stable placeholders ("Categoria 1") when names may not leave
 * OpenMonetis, and puts the real names back into the text the provider writes.
 */
export function createCategoryAliases(revealNames: boolean) {
  const aliasById = new Map<string, string>();
  const nameByAlias = new Map<string, string>();

  return {
    name(categoryId: string | null, realName: string | null) {
      if (revealNames || !categoryId || realName === null) return realName;
      const existing = aliasById.get(categoryId);
      if (existing) return existing;
      const alias = `${aliasPrefix} ${aliasById.size + 1}`;
      aliasById.set(categoryId, alias);
      nameByAlias.set(alias, realName);
      return alias;
    },
    restore,
    /**
     * Restores text that arrives in chunks. A placeholder may be split across chunks, so the tail
     * that could still become one is held back until the next chunk or `flush`.
     */
    createStream() {
      let pending = "";
      return {
        push(chunk: string) {
          pending += chunk;
          if (revealNames) {
            const ready = pending;
            pending = "";
            return ready;
          }
          const cut = pending.search(partialAliasPattern);
          const ready = cut < 0 ? pending : pending.slice(0, cut);
          pending = pending.slice(ready.length);
          return restore(ready);
        },
        flush() {
          const ready = restore(pending);
          pending = "";
          return ready;
        },
      };
    },
  };

  function restore(text: string) {
    if (revealNames) return text;
    return text.replace(aliasPattern, (alias) => nameByAlias.get(alias) ?? alias);
  }
}
