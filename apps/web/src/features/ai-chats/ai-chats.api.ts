import type {
  AiChatOutput,
  AiChatStreamEvent,
  AiChatSummaryOutput,
  AiChatsOutput,
  CreateAiChatInput,
  RegenerateAiChatReplyInput,
  SendAiChatMessageInput,
  UpdateAiChatInput,
} from "@openmonetis/validators/ai-chats";
import { ApiClientError, apiUrl, requestApi } from "@/lib/api-client";

export class AiChatsApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "AiChatsApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new AiChatsApiError(message, code, status),
  });
}

export function getAiChats(signal?: AbortSignal) {
  return request<AiChatsOutput>("/ai-chats", { signal });
}

export function getAiChat(id: string, signal?: AbortSignal) {
  return request<AiChatOutput>(`/ai-chats/${id}`, { signal });
}

export function createAiChat(input: CreateAiChatInput) {
  return request<AiChatOutput>("/ai-chats", { method: "POST", body: JSON.stringify(input) });
}

export function updateAiChat(id: string, input: UpdateAiChatInput) {
  return request<AiChatSummaryOutput>(`/ai-chats/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAiChat(id: string) {
  return request<{ id: string }>(`/ai-chats/${id}`, { method: "DELETE" });
}

export function sendAiChatMessage(
  id: string,
  input: SendAiChatMessageInput,
  signal: AbortSignal,
  onEvent: (event: AiChatStreamEvent) => void,
) {
  return streamReply(`/ai-chats/${id}/messages`, input, signal, onEvent);
}

export function regenerateAiChatReply(
  id: string,
  input: RegenerateAiChatReplyInput,
  signal: AbortSignal,
  onEvent: (event: AiChatStreamEvent) => void,
) {
  return streamReply(`/ai-chats/${id}/regenerate`, input, signal, onEvent);
}

/** Posts and reads the reply as server-sent events until the stream ends. */
async function streamReply(
  path: string,
  body: unknown,
  signal: AbortSignal,
  onEvent: (event: AiChatStreamEvent) => void,
) {
  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new AiChatsApiError(payload?.message ?? "Request failed", payload?.code, response.status);
  }

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      const data = block
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trimStart())
        .join("\n");
      if (data) onEvent(JSON.parse(data) as AiChatStreamEvent);
    }
  }
}
