import type { CreateAiDiagnosisInput } from "@openmonetis/validators/ai-diagnoses";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cancelAiDiagnosis, createAiDiagnosis, deleteAiDiagnosis } from "./ai-diagnoses.api";
import { aiDiagnosisKeys } from "./ai-diagnoses.queries";

export function useCreateAiDiagnosisMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiDiagnosisInput) => createAiDiagnosis(input),
    onSuccess: (diagnosis) => {
      client.setQueryData(aiDiagnosisKeys.detail(diagnosis.id), diagnosis);
      return client.invalidateQueries({ queryKey: aiDiagnosisKeys.list() });
    },
  });
}

export function useCancelAiDiagnosisMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelAiDiagnosis(id),
    onSuccess: (diagnosis) => {
      client.setQueryData(aiDiagnosisKeys.detail(diagnosis.id), diagnosis);
      return client.invalidateQueries({ queryKey: aiDiagnosisKeys.list() });
    },
    // A diagnosis that finished meanwhile is refreshed instead of shown as running.
    onError: (_error, id) => client.invalidateQueries({ queryKey: aiDiagnosisKeys.detail(id) }),
  });
}

export function useDeleteAiDiagnosisMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAiDiagnosis(id),
    onSuccess: ({ id }) => {
      client.removeQueries({ queryKey: aiDiagnosisKeys.detail(id) });
      return client.invalidateQueries({ queryKey: aiDiagnosisKeys.list() });
    },
  });
}
