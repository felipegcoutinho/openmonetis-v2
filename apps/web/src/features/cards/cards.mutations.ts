import type { ReplaceCardInput, UpdateCardInput } from "@openmonetis/validators/cards";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { createCard, deleteCard, replaceCard, updateCard } from "./cards.api";

export function useCreateCardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createCard,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useReplaceCardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReplaceCardInput }) => replaceCard(id, input),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useArchiveCardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => updateCard(id, { status: "inactive" } satisfies UpdateCardInput),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useDeleteCardMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteCard,
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
