import { cn } from "@/lib/utils";

export const headerIconButtonClassName =
  "max-md:size-11 md:size-10 rounded-md text-muted-foreground hover:bg-foreground/6 hover:text-foreground aria-expanded:bg-foreground/8 aria-expanded:text-foreground";

/*
 * Header item backgrounds are a tint of the foreground, never `--muted` or `--brand`: those vary
 * from near-invisible to saturated between palettes, while a foreground tint keeps the same
 * contrast against the navbar in every one. The active section is marked by its text colour.
 * A trigger keeps focus after its menu closes, so focus alone paints nothing (only keyboard focus).
 */
export const desktopNavigationItemClassName =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-foreground/6 focus:bg-transparent hover:focus:bg-foreground/6 focus-visible:bg-foreground/6 data-open:bg-foreground/8 data-popup-open:bg-foreground/8 data-open:hover:bg-foreground/8 data-popup-open:hover:bg-foreground/8 data-open:focus:bg-foreground/8 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring motion-reduce:transition-none";

export const desktopNavigationActiveClassName =
  "bg-foreground/8 text-brand-strong hover:bg-foreground/8 focus:bg-foreground/8 hover:focus:bg-foreground/8";

/** Surface of every desktop navigation menu; the preview menus use it for each of their panels. */
export const desktopNavigationPanelClassName = "material rounded-lg border shadow-menu p-1.5";

export const previewNavigationSections = new Set(["Finanças", "Organização"]);

export const mobileNavigationTopThreshold = 64;

export const mobileNavigationHideDistance = 20;

export const mobileNavigationShowDistance = 12;

/** Tab bar item, icon only: the active tab is marked by colour and an icon pill. */
export function mobileNavigationItemClassName(active: boolean) {
  return cn(
    "group/nav-item flex min-h-14 min-w-0 items-center justify-center rounded-lg text-muted-foreground outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50",
    active && "text-brand-strong",
  );
}
