import { useRouter } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTopmostMobileSurface } from "@/components/forms/mobile-surface";
import { hapticTick } from "@/lib/haptics";
import { isAppleTouchDevice, isStandaloneDisplay } from "@/lib/pwa";

const edgeWidthPx = 24;
const triggerDistancePx = 72;
const maxDistancePx = 96;
const decisionDistancePx = 8;

/**
 * Swipe from the left edge to go back, for the app installed on iPhone: iOS removes Safari's
 * own back gesture in standalone mode, and there is no system Back button. Android keeps its
 * system gesture, so this stays off there and in browser tabs.
 */
export function EdgeSwipeBack() {
  const router = useRouter();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(isStandaloneDisplay() && isAppleTouchDevice());
  }, []);

  useEffect(() => {
    const indicator = indicatorRef.current;
    if (!enabled || !indicator) return;
    let start: { x: number; y: number } | null = null;
    let swiping = false;
    let armed = false;

    function show(distance: number) {
      indicator?.style.setProperty("--edge-distance", `${distance}px`);
      indicator?.style.setProperty(
        "--edge-progress",
        String(Math.min(1, distance / triggerDistancePx)),
      );
    }

    function reset() {
      start = null;
      swiping = false;
      armed = false;
      indicator?.setAttribute("data-state", "idle");
      indicator?.removeAttribute("data-armed");
      show(0);
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = event.touches[0];
      if (
        event.touches.length !== 1 ||
        touch.clientX > edgeWidthPx ||
        getTopmostMobileSurface() ||
        !router.history.canGoBack()
      ) {
        start = null;
        return;
      }
      start = { x: touch.clientX, y: touch.clientY };
    }

    function handleTouchMove(event: TouchEvent) {
      if (!start) return;
      const dx = event.touches[0].clientX - start.x;
      const dy = event.touches[0].clientY - start.y;
      if (!swiping) {
        if (Math.hypot(dx, dy) < decisionDistancePx) return;
        if (dx <= 0 || Math.abs(dy) > dx) {
          start = null;
          return;
        }
        swiping = true;
        indicator?.setAttribute("data-state", "swiping");
      }
      event.preventDefault();
      const distance = Math.min(maxDistancePx, dx * 0.6);
      show(distance);
      const nowArmed = distance >= triggerDistancePx * 0.6 && dx >= triggerDistancePx;
      if (nowArmed && !armed) hapticTick();
      armed = nowArmed;
      indicator?.toggleAttribute("data-armed", armed);
    }

    function handleTouchEnd() {
      const goBack = swiping && armed;
      reset();
      if (goBack) router.history.back();
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [enabled, router]);

  if (!enabled) return null;
  return (
    <div aria-hidden="true" className="edge-swipe-back" data-state="idle" ref={indicatorRef}>
      <ChevronLeft className="size-5" />
    </div>
  );
}
