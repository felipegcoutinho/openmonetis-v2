import type {
  CreateInstallmentAnticipationInput,
  UndoInstallmentAnticipationInput,
} from "@openmonetis/validators/installments";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  anticipateInstallments,
  simulateInstallmentPurchase,
  undoInstallmentAnticipation,
} from "./installments.api";

/** No cache invalidation: a simulation never changes stored data. */
export function useInstallmentPurchaseSimulationMutation() {
  return useMutation({ mutationFn: simulateInstallmentPurchase });
}

export function useAnticipateInstallmentsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      seriesId,
      input,
    }: {
      seriesId: string;
      input: CreateInstallmentAnticipationInput;
    }) => anticipateInstallments(seriesId, input),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}

export function useUndoInstallmentAnticipationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      seriesId,
      anticipationId,
      input,
    }: {
      seriesId: string;
      anticipationId: string;
      input: UndoInstallmentAnticipationInput;
    }) => undoInstallmentAnticipation(seriesId, anticipationId, input),
    onSuccess: () => refreshFinancialQueries(queryClient),
  });
}
