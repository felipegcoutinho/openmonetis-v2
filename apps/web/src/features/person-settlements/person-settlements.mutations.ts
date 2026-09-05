import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createPersonSettlement, deletePersonSettlement } from "./person-settlements.api";
import { personSettlementKeys } from "./person-settlements.queries";

function useSettlementMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: personSettlementKeys.all });
    },
  });
}

export const useCreatePersonSettlementMutation = () =>
  useSettlementMutation(createPersonSettlement);
export const useDeletePersonSettlementMutation = () =>
  useSettlementMutation(deletePersonSettlement);
