import { prefersReducedMotion } from "./pwa";

type NavigationTransitionInput = {
  fromLocation?: { pathname: string };
  toLocation: { pathname: string };
  pathChanged: boolean;
};

/** Phones only: a desktop window keeps instant page changes. */
const phoneQuery = "(max-width: 767px)";

function depth(pathname: string) {
  return pathname.split("/").filter(Boolean).length;
}

/**
 * Picks the native-style transition for a navigation: deeper screens push in from the trailing
 * edge, going up pops back, and switching between top-level destinations cross-fades like a tab
 * bar. Filter, period and search changes keep the same screen and do not animate.
 */
export function getNavigationTransitionTypes({
  fromLocation,
  toLocation,
  pathChanged,
}: NavigationTransitionInput): string[] | false {
  if (typeof window === "undefined" || !fromLocation || !pathChanged) return false;
  if (!window.matchMedia(phoneQuery).matches || prefersReducedMotion()) return false;
  const from = depth(fromLocation.pathname);
  const to = depth(toLocation.pathname);
  if (to > from) return ["push"];
  if (to < from) return ["pop"];
  return ["tab"];
}

/**
 * Router option. Browsers with view transitions but without transition types would cross-fade
 * every navigation, filters and desktop included, so they keep instant changes.
 */
export function getNavigationViewTransition() {
  if (typeof window === "undefined" || typeof document.startViewTransition !== "function") {
    return false;
  }
  if (!window.CSS?.supports?.("selector(:active-view-transition-type(a))")) return false;
  return { types: getNavigationTransitionTypes };
}
