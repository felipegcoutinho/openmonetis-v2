import type { CreateAiChatInput, UpdateAiChatInput } from "@openmonetis/validators/ai-chats";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createAiChat, deleteAiChat, updateAiChat } from "./ai-chats.api";
import { aiChatKeys } from "./ai-chats.queries";

export function useCreateAiChatMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiChatInput) => createAiChat(input),
    onSuccess: (chat) => {
      client.setQueryData(aiChatKeys.detail(chat.id), chat);
      return client.invalidateQueries({ queryKey: aiChatKeys.list() });
    },
  });
}

export function useRenameAiChatMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateAiChatInput & { id: string }) => updateAiChat(id, input),
    onSuccess: (chat) => {
      client.setQueryData(aiChatKeys.detail(chat.id), (previous) =>
        previous ? { ...previous, ...chat } : previous,
      );
      return client.invalidateQueries({ queryKey: aiChatKeys.list() });
    },
  });
}

export function useDeleteAiChatMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAiChat(id),
    onSuccess: ({ id }) => {
      client.removeQueries({ queryKey: aiChatKeys.detail(id) });
      return client.invalidateQueries({ queryKey: aiChatKeys.list() });
    },
  });
}
