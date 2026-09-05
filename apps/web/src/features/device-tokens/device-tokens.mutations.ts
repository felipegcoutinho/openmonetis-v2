import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createDeviceToken, revokeDeviceToken } from "./device-tokens.api";
import { deviceTokenKeys } from "./device-tokens.queries";

export function useCreateDeviceTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createDeviceToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deviceTokenKeys.all }),
  });
}

export function useRevokeDeviceTokenMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeDeviceToken,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: deviceTokenKeys.all }),
  });
}
