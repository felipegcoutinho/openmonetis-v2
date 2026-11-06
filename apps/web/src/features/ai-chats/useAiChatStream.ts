import type {
  AiChatMessageOutput,
  AiChatOutput,
  AiChatStreamEvent,
  RegenerateAiChatReplyInput,
  SendAiChatMessageInput,
} from "@openmonetis/validators/ai-chats";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatStatus } from "@/components/ai-elements/prompt-input";
import { regenerateAiChatReply, sendAiChatMessage } from "./ai-chats.api";
import { aiChatErrorMessage } from "./ai-chats.presentation";
import { aiChatKeys } from "./ai-chats.queries";

/** The reply being written right now; it lives only in this tab until the API saves it. */
export type StreamingReply = {
  chatId: string;
  pendingQuestion: string | null;
  assistantId: string | null;
  content: string;
  reasoning: string;
};

type Start = (signal: AbortSignal, onEvent: (event: AiChatStreamEvent) => void) => Promise<void>;

export function useAiChatStream() {
  const client = useQueryClient();
  const [reply, setReply] = useState<StreamingReply | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  function updateChat(chatId: string, update: (chat: AiChatOutput) => AiChatOutput) {
    client.setQueryData<AiChatOutput>(aiChatKeys.detail(chatId), (chat) =>
      chat ? update(chat) : chat,
    );
  }

  function handleEvent(chatId: string, event: AiChatStreamEvent) {
    if (event.type === "start") {
      updateChat(chatId, (chat) => ({
        ...chat,
        ...event.chat,
        messages: [
          // A regenerated answer replaces the previous one after the last question.
          ...(event.userMessage ? chat.messages : withoutTrailingAnswers(chat.messages)),
          ...(event.userMessage ? [event.userMessage] : []),
          event.assistantMessage,
        ],
      }));
      setReply(
        (current) =>
          current && { ...current, pendingQuestion: null, assistantId: event.assistantMessage.id },
      );
    } else if (event.type === "delta") {
      setReply((current) => current && { ...current, content: current.content + event.text });
    } else if (event.type === "reasoning") {
      setReply((current) => current && { ...current, reasoning: current.reasoning + event.text });
    } else {
      updateChat(chatId, (chat) => ({
        ...chat,
        messages: chat.messages.map((message) =>
          message.id === event.message.id ? event.message : message,
        ),
      }));
    }
  }

  /** Resolves `true` once the API accepted the request, `false` when it was refused. */
  async function run(chatId: string, pendingQuestion: string | null, start: Start) {
    const controller = new AbortController();
    controllerRef.current = controller;
    setReply({ chatId, pendingQuestion, assistantId: null, content: "", reasoning: "" });
    try {
      await start(controller.signal, (event) => handleEvent(chatId, event));
      return true;
    } catch (error) {
      if (controller.signal.aborted) return true;
      toast.error(aiChatErrorMessage(error));
      return false;
    } finally {
      controllerRef.current = null;
      setReply(null);
      void client.invalidateQueries({ queryKey: aiChatKeys.detail(chatId) });
      void client.invalidateQueries({ queryKey: aiChatKeys.list() });
    }
  }

  const status: ChatStatus = !reply ? "ready" : reply.assistantId ? "streaming" : "submitted";

  return {
    reply,
    status,
    send: (chatId: string, input: SendAiChatMessageInput) =>
      run(chatId, input.content, (signal, onEvent) =>
        sendAiChatMessage(chatId, input, signal, onEvent),
      ),
    regenerate: (chatId: string, input: RegenerateAiChatReplyInput) =>
      run(chatId, null, (signal, onEvent) => regenerateAiChatReply(chatId, input, signal, onEvent)),
    stop: () => controllerRef.current?.abort(),
  };
}

function withoutTrailingAnswers(messages: AiChatMessageOutput[]) {
  let end = messages.length;
  while (end > 0 && messages[end - 1]?.role === "assistant") end -= 1;
  return messages.slice(0, end);
}
