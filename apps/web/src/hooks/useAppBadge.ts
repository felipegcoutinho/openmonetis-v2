import { useEffect } from "react";

type BadgingNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Mirrors a count on the icon of the installed app (Badging API); no-op elsewhere. */
export function useAppBadge(count: number) {
  useEffect(() => {
    const badging = navigator as BadgingNavigator;
    if (!badging.setAppBadge || !badging.clearAppBadge) return;
    const update = count > 0 ? badging.setAppBadge(count) : badging.clearAppBadge();
    void update.catch(() => {
      // The page is not installed or the permission is missing: the in-app badge remains.
    });
  }, [count]);
}
