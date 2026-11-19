import { useEffect } from "react";
import { hapticTick } from "@/lib/haptics";
import { prefersReducedMotion } from "@/lib/pwa";

export type SwipeDismissDirection = "down" | "right";

type SwipeToDismissOptions = {
  enabled: boolean;
  direction?: SwipeDismissDirection;
};

/** The same controls the Back button uses, so discard guards and pending saves still apply. */
const closeControlSelector =
  '[data-mobile-back], [data-slot="sheet-close"], [data-slot="dialog-close"]';
/** Gestures that start on these keep their native behavior (text selection, sliders, carousels). */
const ignoredTargetSelector =
  'input, textarea, select, [contenteditable="true"], [role="slider"], [data-swipe-ignore]';
const decisionDistancePx = 8;
const dismissDistanceRatio = 0.25;
const maxDismissDistancePx = 140;
const flickVelocityPxPerMs = 0.5;
const minFlickDistancePx = 24;
const exitDurationMs = 200;
const cancelCheckDelayMs = 160;
const cleanupDelayMs = 480;

/**
 * Lets a touch user drag a sheet off screen, like a native bottom sheet or side drawer. The drag
 * starts anywhere on the surface, unless the content under the finger can still scroll back.
 * Releasing past a quarter of the surface (or with a flick) closes it through its own close
 * control; otherwise it springs back. If the close is cancelled (unsaved changes), it returns.
 */
export function useSwipeToDismiss(
  element: HTMLElement | null,
  { enabled, direction = "down" }: SwipeToDismissOptions,
) {
  useEffect(() => {
    if (!enabled || !element) return;
    const surface = element;
    const vertical = direction === "down";
    let start: { x: number; y: number } | null = null;
    let decided = false;
    let dragging = false;
    let last = { position: 0, time: 0 };
    let previous = { position: 0, time: 0 };
    const timers = new Set<number>();

    function later(callback: () => void, delay: number) {
      const id = window.setTimeout(() => {
        timers.delete(id);
        callback();
      }, delay);
      timers.add(id);
    }

    function translateTo(offset: string) {
      surface.style.translate = vertical ? `0 ${offset}` : `${offset} 0`;
    }

    function clearInlineStyles() {
      surface.style.removeProperty("translate");
      surface.style.removeProperty("transition");
      delete surface.dataset.swiping;
    }

    function isOpen() {
      return (
        surface.isConnected &&
        !surface.hasAttribute("data-ending-style") &&
        !surface.hasAttribute("data-closed")
      );
    }

    function settle() {
      if (prefersReducedMotion()) {
        clearInlineStyles();
        return;
      }
      surface.style.transition = "translate var(--duration-base) var(--ease-out-strong)";
      translateTo("0px");
      later(clearInlineStyles, 260);
    }

    function close() {
      surface.querySelector<HTMLElement>(closeControlSelector)?.click();
      // A discard guard may keep the surface open: bring it back into view.
      later(() => {
        if (isOpen()) settle();
        else later(clearInlineStyles, cleanupDelayMs);
      }, cancelCheckDelayMs);
    }

    function dismiss() {
      hapticTick();
      if (prefersReducedMotion()) {
        clearInlineStyles();
        close();
        return;
      }
      surface.style.transition = `translate ${exitDurationMs}ms var(--ease-out-strong)`;
      translateTo("100%");
      later(close, exitDurationMs);
    }

    /** True when the finger is over content that can still scroll back toward the edge. */
    function canScrollBack(target: Element) {
      for (let node: Element | null = target; node; node = node.parentElement) {
        const style = getComputedStyle(node);
        const overflow = vertical ? style.overflowY : style.overflowX;
        const scrolled = vertical ? node.scrollTop > 0 : node.scrollLeft > 0;
        if (scrolled && (overflow === "auto" || overflow === "scroll")) return true;
        if (node === surface) break;
      }
      return false;
    }

    function reset() {
      start = null;
      decided = false;
      dragging = false;
    }

    function handleTouchStart(event: TouchEvent) {
      if (event.touches.length !== 1) {
        reset();
        return;
      }
      const touch = event.touches[0];
      start = { x: touch.clientX, y: touch.clientY };
      decided = false;
      dragging = false;
    }

    function handleTouchMove(event: TouchEvent) {
      if (!start) return;
      const touch = event.touches[0];
      const along = vertical ? touch.clientY - start.y : touch.clientX - start.x;
      const across = vertical ? touch.clientX - start.x : touch.clientY - start.y;

      if (!decided) {
        if (Math.hypot(along, across) < decisionDistancePx) return;
        decided = true;
        const target = event.target instanceof Element ? event.target : surface;
        if (
          along <= 0 ||
          Math.abs(across) > along ||
          target.closest(ignoredTargetSelector) ||
          canScrollBack(target)
        ) {
          start = null;
          return;
        }
        dragging = true;
        surface.dataset.swiping = "";
        surface.style.transition = "none";
        previous = last = { position: along, time: event.timeStamp };
      }

      if (!dragging) return;
      event.preventDefault();
      translateTo(`${Math.max(0, along)}px`);
      previous = last;
      last = { position: along, time: event.timeStamp };
    }

    function handleTouchEnd() {
      if (!dragging) {
        reset();
        return;
      }
      const size = vertical ? surface.offsetHeight : surface.offsetWidth;
      const threshold = Math.min(maxDismissDistancePx, size * dismissDistanceRatio);
      const velocity = (last.position - previous.position) / Math.max(1, last.time - previous.time);
      const flicked = velocity > flickVelocityPxPerMs && last.position > minFlickDistancePx;
      reset();
      if (last.position > threshold || flicked) dismiss();
      else settle();
    }

    function handleTouchCancel() {
      if (dragging) settle();
      reset();
    }

    surface.addEventListener("touchstart", handleTouchStart, { passive: true });
    surface.addEventListener("touchmove", handleTouchMove, { passive: false });
    surface.addEventListener("touchend", handleTouchEnd, { passive: true });
    surface.addEventListener("touchcancel", handleTouchCancel, { passive: true });
    return () => {
      surface.removeEventListener("touchstart", handleTouchStart);
      surface.removeEventListener("touchmove", handleTouchMove);
      surface.removeEventListener("touchend", handleTouchEnd);
      surface.removeEventListener("touchcancel", handleTouchCancel);
      for (const id of timers) window.clearTimeout(id);
      clearInlineStyles();
    };
  }, [element, enabled, direction]);
}
