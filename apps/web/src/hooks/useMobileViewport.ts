import { useEffect } from "react";
import { useIsMobile } from "./useIsMobile";

/** Keep a mobile overlay inside the visual viewport when the software keyboard opens. */
export function useMobileViewport(element: HTMLElement | null) {
  const mobile = useIsMobile();
  useEffect(() => {
    if (!mobile || !element) return;
    const viewport = window.visualViewport;
    function updateViewport() {
      if (!element) return;
      // Preserve browser panning while the user is zooming.
      const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.01;
      element.style.setProperty(
        "--form-height",
        unzoomed && viewport ? `${viewport.height}px` : "100dvh",
      );
      element.style.setProperty(
        "--form-top",
        unzoomed && viewport ? `${viewport.offsetTop}px` : "0px",
      );
    }
    updateViewport();
    viewport?.addEventListener("resize", updateViewport);
    viewport?.addEventListener("scroll", updateViewport);
    return () => {
      viewport?.removeEventListener("resize", updateViewport);
      viewport?.removeEventListener("scroll", updateViewport);
      element.style.removeProperty("--form-height");
      element.style.removeProperty("--form-top");
    };
  }, [element, mobile]);
}
