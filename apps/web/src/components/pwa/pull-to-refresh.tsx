import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getTopmostMobileSurface } from "@/components/forms/mobile-surface";
import { hapticTick } from "@/lib/haptics";
import { isStandaloneDisplay } from "@/lib/pwa";
import { cn } from "@/lib/utils";

const triggerDistancePx = 72;
const maxPullDistancePx = 112;
/** Resistance: the indicator travels about half as far as the finger, like a native list. */
const pullResistance = 0.5;
const decisionDistancePx = 6;
/** Keeps the spinner up long enough to read as feedback even when the refetch is instant. */
const minimumRefreshMs = 650;
const ignoredTargetSelector = 'input, textarea, select, [role="slider"], [data-swipe-ignore]';

/**
 * Pull to refresh for the installed app, where neither iOS nor Android offer the browser's own.
 * Pulling down from the top of a screen refetches the queries on screen; in a browser tab the
 * native gesture stays in charge and this component does nothing.
 */
export function PullToRefresh() {
  const queryClient = useQueryClient();
  const indicatorRef = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setEnabled(isStandaloneDisplay() && window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    const indicator = indicatorRef.current;
    if (!enabled || !indicator) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let armed = false;
    let busy = false;

    function show(distance: number) {
      indicator?.style.setProperty("--pull-distance", `${distance}px`);
      indicator?.style.setProperty(
        "--pull-progress",
        String(Math.min(1, distance / triggerDistancePx)),
      );
    }

    function handleTouchStart(event: TouchEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (
        busy ||
        event.touches.length !== 1 ||
        window.scrollY > 0 ||
        getTopmostMobileSurface() ||
        target?.closest(ignoredTargetSelector)
      ) {
        start = null;
        return;
      }
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      pulling = false;
      armed = false;
    }

    function handleTouchMove(event: TouchEvent) {
      if (!start) return;
      const dy = event.touches[0].clientY - start.y;
      const dx = event.touches[0].clientX - start.x;
      if (!pulling) {
        if (Math.hypot(dx, dy) < decisionDistancePx) return;
        if (dy <= 0 || Math.abs(dx) > dy || window.scrollY > 0) {
          start = null;
          return;
        }
        pulling = true;
        indicator?.setAttribute("data-state", "pulling");
      }
      event.preventDefault();
      const distance = Math.min(maxPullDistancePx, dy * pullResistance);
      show(distance);
      const nowArmed = distance >= triggerDistancePx;
      if (nowArmed && !armed) hapticTick();
      armed = nowArmed;
      indicator?.toggleAttribute("data-armed", armed);
    }

    async function refresh() {
      busy = true;
      setRefreshing(true);
      indicator?.setAttribute("data-state", "refreshing");
      show(triggerDistancePx * 0.75);
      try {
        await Promise.all([
          queryClient.refetchQueries({ type: "active" }),
          new Promise((resolve) => window.setTimeout(resolve, minimumRefreshMs)),
        ]);
      } finally {
        busy = false;
        setRefreshing(false);
        indicator?.setAttribute("data-state", "idle");
        indicator?.removeAttribute("data-armed");
        show(0);
      }
    }

    function handleTouchEnd() {
      if (!pulling) {
        start = null;
        return;
      }
      start = null;
      pulling = false;
      if (armed) {
        void refresh();
        return;
      }
      indicator?.setAttribute("data-state", "idle");
      show(0);
    }

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    window.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
      window.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [enabled, queryClient]);

  if (!enabled) return null;
  return (
    <div
      aria-hidden={!refreshing}
      className="pull-to-refresh"
      data-state="idle"
      ref={indicatorRef}
      role="status"
    >
      <span className="sr-only">{refreshing ? "Atualizando…" : ""}</span>
      <span className={cn("pull-to-refresh-icon", refreshing && "animate-spin")}>
        <RefreshCw aria-hidden="true" className="size-4.5" />
      </span>
    </div>
  );
}
