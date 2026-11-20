import { useIsMutating, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { usePrivacyMode } from "@/components/privacy-provider";
import { useTheme } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import { appearanceMutationKey } from "../preferences.mutations";
import { getAppearance } from "../preferences.presentation";
import { userPreferencesQueryOptions } from "../preferences.queries";

export function PreferencesSynchronizer() {
  const session = authClient.useSession();
  const userId = session.data?.user.id;
  const preferencesQuery = useQuery(userPreferencesQueryOptions(Boolean(userId)));
  const { setPrivacyModeEnabled } = usePrivacyMode();
  const { setAppearance } = useTheme();
  const privacyInitializedForUser = useRef<string | null>(null);
  // While appearance saves are queued, the answer to an earlier one must not repaint the app over
  // the newer choice already on screen. Once the queue empties, the saved appearance applies, which
  // also restores it after a failed save.
  const savingAppearance = useIsMutating({ mutationKey: appearanceMutationKey }) > 0;

  useEffect(() => {
    if (preferencesQuery.data && !savingAppearance) {
      setAppearance(getAppearance(preferencesQuery.data));
    }
  }, [preferencesQuery.data, savingAppearance, setAppearance]);

  useEffect(() => {
    if (!userId) {
      privacyInitializedForUser.current = null;
      setPrivacyModeEnabled(false);
      return;
    }
    if (!preferencesQuery.data || privacyInitializedForUser.current === userId) return;

    setPrivacyModeEnabled(preferencesQuery.data.hideValuesOnStart);
    privacyInitializedForUser.current = userId;
  }, [preferencesQuery.data, setPrivacyModeEnabled, userId]);

  return null;
}
