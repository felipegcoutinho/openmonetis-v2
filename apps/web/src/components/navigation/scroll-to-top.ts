import type { MouseEvent } from "react";
import { prefersReducedMotion } from "@/lib/pwa";

export function scrollToTop() {
  window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

/**
 * Tab bar convention: tapping the tab of the screen already open scrolls it back to the top
 * instead of reloading it. From a deeper screen the tab still navigates back to its root.
 */
export function scrollToTopWhenCurrent(
  event: MouseEvent<HTMLAnchorElement>,
  pathname: string,
  href: string,
) {
  if (pathname !== href || window.scrollY <= 0) return;
  event.preventDefault();
  scrollToTop();
}
