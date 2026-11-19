import { useEffect, useSyncExternalStore } from "react";

type CompactPageTitle = { title: string; visible: boolean } | null;

let current: CompactPageTitle = null;
const listeners = new Set<() => void>();

function publish(next: CompactPageTitle) {
  if (current?.title === next?.title && current?.visible === next?.visible) return;
  current = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Title the top bar shows once the page heading has scrolled up under it. */
export function useCompactPageTitle() {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * Publishes a page heading to the top bar: it becomes visible there when the heading scrolls
 * under the bar, like a native large title collapsing into the navigation bar.
 */
export function useCompactPageTitleSource(title: string | undefined, heading: HTMLElement | null) {
  useEffect(() => {
    if (!title || !heading) return;
    const barBottom = document.querySelector(".app-navbar")?.getBoundingClientRect().bottom ?? 56;
    const observer = new IntersectionObserver(
      ([entry]) => {
        const scrolledAway =
          !entry.isIntersecting && entry.boundingClientRect.top < (entry.rootBounds?.top ?? 0);
        publish({ title, visible: scrolledAway });
      },
      { rootMargin: `-${Math.round(barBottom)}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(heading);
    return () => {
      observer.disconnect();
      publish(null);
    };
  }, [title, heading]);
}
