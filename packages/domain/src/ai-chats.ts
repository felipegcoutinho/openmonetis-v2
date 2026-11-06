export const aiChatMessageRoles = ["user", "assistant"] as const;
export type AiChatMessageRole = (typeof aiChatMessageRoles)[number];

export const aiChatMessageStatuses = ["streaming", "completed", "failed", "canceled"] as const;
export type AiChatMessageStatus = (typeof aiChatMessageStatuses)[number];

export const aiChatFailureCodes = [
  "providerDisconnected",
  "providerLimitReached",
  "providerBusy",
  "serviceUnavailable",
  "runFailed",
  "timedOut",
  "interrupted",
] as const;
export type AiChatFailureCode = (typeof aiChatFailureCodes)[number];

export const aiChatMessageMaximumLength = 4_000;
export const aiChatTitleMaximumLength = 80;
/** Previous messages sent with each question; older ones stay only in OpenMonetis. */
export const aiChatHistoryLimit = 20;
export const aiChatDailyMessageLimit = 100;
export const aiChatListLimit = 50;
/** A reply still streaming after this long is treated as lost (for example, an API restart). */
export const aiChatStreamingTimeoutMs = 5 * 60_000;

export function isAiChatStreamingExpired(createdAt: Date, now: Date) {
  return now.getTime() - createdAt.getTime() > aiChatStreamingTimeoutMs;
}

/** First line of the first question, shortened on a word boundary. */
export function deriveAiChatTitle(content: string) {
  const line = content.trim().split("\n")[0]?.replace(/\s+/g, " ") ?? "";
  if (line.length <= aiChatTitleMaximumLength) return line || "Nova conversa";
  const cut = line.slice(0, aiChatTitleMaximumLength - 1);
  const boundary = cut.lastIndexOf(" ");
  return `${(boundary > 20 ? cut.slice(0, boundary) : cut).trimEnd()}…`;
}

type HistoryMessage = { role: AiChatMessageRole; status: AiChatMessageStatus; content: string };

/**
 * The turns the provider sees: answered exchanges only (a failed or empty reply carries no
 * context), most recent last, capped at `aiChatHistoryLimit`.
 */
export function selectAiChatHistory<T extends HistoryMessage>(messages: readonly T[]) {
  return messages
    .filter((message) => message.content.trim() && message.status !== "failed")
    .slice(-aiChatHistoryLimit);
}
