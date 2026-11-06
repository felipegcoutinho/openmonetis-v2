import type {
  UpdateAiDataRetentionInput,
  UpdateAiDataSharingInput,
} from "@openmonetis/validators/ai-data-sharing";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { aiChatKeys } from "@/features/ai-chats/ai-chats.queries";
import { aiDiagnosisKeys } from "@/features/ai-diagnoses/ai-diagnoses.queries";
import {
  deleteAiDataHistory,
  updateAiDataRetention,
  updateAiDataSharing,
} from "./ai-data-sharing.api";
import { aiDataSharingKeys } from "./ai-data-sharing.queries";

export function useUpdateAiDataSharingMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiDataSharingInput) => updateAiDataSharing(input),
    onSuccess: (sharing) => {
      client.setQueryData(aiDataSharingKeys.all, sharing);
      client.removeQueries({ queryKey: aiDataSharingKeys.previews() });
    },
  });
}

export function useUpdateAiDataRetentionMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateAiDataRetentionInput) => updateAiDataRetention(input),
    onSuccess: (sharing) => client.setQueryData(aiDataSharingKeys.all, sharing),
  });
}

export function useDeleteAiDataHistoryMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deleteAiDataHistory,
    onSuccess: () => {
      client.removeQueries({ queryKey: aiChatKeys.all });
      client.removeQueries({ queryKey: aiDiagnosisKeys.all });
    },
  });
}
