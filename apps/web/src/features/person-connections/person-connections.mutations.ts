import { useMutation, useQueryClient } from "@tanstack/react-query";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import {
  cancelPersonConnectionInvitation,
  claimPersonConnectionInvitation,
  confirmPersonConnectionInvitation,
  createPersonConnectionInvitation,
  revokePersonConnection,
} from "./person-connections.api";
import { personConnectionKeys } from "./person-connections.queries";

function useConnectionMutation<TVariables, TData>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: { refreshFinancialData?: boolean } = {},
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: personConnectionKeys.all });
      if (options.refreshFinancialData) await refreshFinancialQueries(client);
    },
  });
}

export const useCreatePersonConnectionInvitationMutation = () =>
  useConnectionMutation(createPersonConnectionInvitation);
export const useClaimPersonConnectionInvitationMutation = () =>
  useConnectionMutation(claimPersonConnectionInvitation);
export const useConfirmPersonConnectionInvitationMutation = () =>
  useConnectionMutation(({ id, confirmationCode }: { id: string; confirmationCode: string }) =>
    confirmPersonConnectionInvitation(id, confirmationCode),
  );
export const useCancelPersonConnectionInvitationMutation = () =>
  useConnectionMutation(cancelPersonConnectionInvitation);
export const useRevokePersonConnectionMutation = () =>
  useConnectionMutation(revokePersonConnection, { refreshFinancialData: true });
