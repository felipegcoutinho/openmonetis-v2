import { useSyncExternalStore } from "react";

const mobileMediaQuery = "(max-width: 767px)";

function subscribe(callback: () => void) {
  const mediaQuery = window.matchMedia(mobileMediaQuery);
  mediaQuery.addEventListener("change", callback);

  return () => mediaQuery.removeEventListener("change", callback);
}

function getBrowserSnapshot() {
  return window.matchMedia(mobileMediaQuery).matches;
}

function getServerSnapshot() {
  return null;
}

export function useIsMobile() {
  return useSyncExternalStore<boolean | null>(subscribe, getBrowserSnapshot, getServerSnapshot);
}
