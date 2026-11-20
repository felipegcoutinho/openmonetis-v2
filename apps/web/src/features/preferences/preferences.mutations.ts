import type {
  UpdateUserPreferencesInput,
  UserPreferencesOutput,
} from "@openmonetis/validators/preferences";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationKeys } from "@/features/notifications/notifications.queries";
import { updateUserPreferences } from "./preferences.api";
import { preferenceKeys } from "./preferences.queries";

function usePreferenceMutationCache() {
  const queryClient = useQueryClient();

  return (preferences: UserPreferencesOutput) => {
    queryClient.setQueryData(preferenceKeys.all, preferences);
    void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
  };
}

export function useUpdateUserPreferencesMutation() {
  const updateCache = usePreferenceMutationCache();

  return useMutation({
    mutationFn: (input: UpdateUserPreferencesInput) => updateUserPreferences(input),
    onSuccess: updateCache,
  });
}

/**
 * Saves appearance changes one after another, so a slow earlier answer never lands after a newer
 * choice and paints the app with a theme the person already left.
 */
export const appearanceMutationKey = ["preferences", "appearance"] as const;

export function useUpdateAppearanceMutation() {
  const updateCache = usePreferenceMutationCache();

  return useMutation({
    mutationFn: (input: UpdateUserPreferencesInput) => updateUserPreferences(input),
    mutationKey: appearanceMutationKey,
    onSuccess: updateCache,
    scope: { id: "appearance" },
  });
}
