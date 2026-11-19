import { cn } from "@/lib/utils";

export const headerIconButtonClassName =
  "max-md:size-11 md:size-10 rounded-md text-muted-foreground hover:bg-primary/10 hover:text-foreground aria-expanded:bg-primary/10 aria-expanded:text-foreground";

export const desktopNavigationItemClassName =
  "inline-flex h-8 items-center justify-center rounded-md border-0 bg-transparent px-3 text-sm font-medium text-foreground transition-colors duration-150 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring motion-reduce:transition-none";

export const desktopNavigationActiveClassName =
  "bg-brand/10 text-brand-strong hover:bg-brand/15 focus:bg-brand/10 data-open:bg-brand/15 data-popup-open:bg-brand/15 data-open:hover:bg-brand/15 data-popup-open:hover:bg-brand/15 data-open:focus:bg-brand/15";

export const desktopNavigationPopupClassName = "material rounded-lg shadow-menu";

export const previewNavigationSections = new Set(["Finanças", "Organização"]);

export const mobileNavigationTopThreshold = 64;

export const mobileNavigationHideDistance = 20;

export const mobileNavigationShowDistance = 12;

/** Tab bar item: the label stays put; the active tab is marked by colour and an icon pill. */
export function mobileNavigationItemClassName(active: boolean) {
  return cn(
    "group/nav-item flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-2xs text-muted-foreground outline-none [-webkit-tap-highlight-color:transparent] focus-visible:ring-3 focus-visible:ring-ring/50",
    active && "font-medium text-brand-strong",
  );
}
