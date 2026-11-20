import { useSyncExternalStore } from "react";

/**
 * Whether a CSS media query matches, kept in sync with the browser. The server render and the
 * hydration pass read `false`, so anything shown only on a match never mismatches the HTML.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (callback) => {
      const mediaQuery = window.matchMedia(query);
      mediaQuery.addEventListener("change", callback);
      return () => mediaQuery.removeEventListener("change", callback);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
