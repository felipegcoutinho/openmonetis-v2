import type { ChangePasswordInput } from "@openmonetis/validators/auth";
import type {
  DeleteSettingsAccountInput,
  ResetSettingsInput,
} from "@openmonetis/validators/settings";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addPasskey,
  changeSettingsPassword,
  deleteSettingsAccount,
  removePasskey,
  renamePasskey,
  resetSettings,
} from "./settings.api";
import { settingsKeys } from "./settings.queries";

export function useResetSettingsMutation() {
  return useMutation({ mutationFn: (input: ResetSettingsInput) => resetSettings(input) });
}

export function useDeleteSettingsAccountMutation() {
  return useMutation({
    mutationFn: (input: DeleteSettingsAccountInput) => deleteSettingsAccount(input),
  });
}

export function useChangeSettingsPasswordMutation() {
  return useMutation({
    gcTime: 0,
    mutationFn: (input: ChangePasswordInput) => changeSettingsPassword(input),
  });
}

export function useAddPasskeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name?: string) => addPasskey(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.passkeys() }),
  });
}

export function useRenamePasskeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renamePasskey(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.passkeys() }),
  });
}

export function useRemovePasskeyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => removePasskey(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: settingsKeys.passkeys() }),
  });
}
