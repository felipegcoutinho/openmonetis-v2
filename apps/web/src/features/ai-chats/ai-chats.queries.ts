import { queryOptions } from "@tanstack/react-query";
import { getAiChat, getAiChats } from "./ai-chats.api";

export const aiChatKeys = {
  all: ["ai-chats"] as const,
  list: () => [...aiChatKeys.all, "list"] as const,
  detail: (id: string) => [...aiChatKeys.all, "detail", id] as const,
};

export function aiChatsQueryOptions() {
  return queryOptions({
    queryKey: aiChatKeys.list(),
    queryFn: ({ signal }) => getAiChats(signal),
  });
}

export function aiChatQueryOptions(id: string) {
  return queryOptions({
    queryKey: aiChatKeys.detail(id),
    queryFn: ({ signal }) => getAiChat(id, signal),
  });
}
