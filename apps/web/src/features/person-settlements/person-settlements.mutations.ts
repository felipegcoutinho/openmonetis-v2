import { useMutation, useQueryClient } from "@tanstack/react-query";
import { personReportKeys } from "../person-reports/person-reports.queries";
import { createPersonSettlement, deletePersonSettlement } from "./person-settlements.api";
import { personSettlementKeys } from "./person-settlements.queries";

function useSettlementMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: personSettlementKeys.all }),
        client.invalidateQueries({ queryKey: personReportKeys.all }),
      ]);
    },
  });
}

export const useCreatePersonSettlementMutation = () =>
  useSettlementMutation(createPersonSettlement);
export const useDeletePersonSettlementMutation = () =>
  useSettlementMutation(deletePersonSettlement);
