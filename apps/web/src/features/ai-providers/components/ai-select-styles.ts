/**
 * Menus of the AI selects grow with the longest name instead of the trigger's width, and leave room
 * for the check mark so names like "Claude Sonnet 5.5 (Medium)" never run under it.
 */
export const aiSelectContentClassName =
  "w-auto min-w-(--anchor-width) max-w-[min(22rem,var(--available-width))] p-1";

export const aiSelectItemClassName = "gap-2.5 py-2 pr-9 pl-2.5";
