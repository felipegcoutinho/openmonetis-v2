/** Closed portals can stay mounted; only a visible surface should consume Back. */
export function getTopmostMobileSurface() {
  const surfaces = document.querySelectorAll<HTMLElement>(
    '[role="dialog"], [role="alertdialog"], [data-mobile-select]',
  );
  return [...surfaces]
    .reverse()
    .find(
      (surface) =>
        !surface.hasAttribute("data-closed") &&
        !surface.hasAttribute("data-ending-style") &&
        surface.getBoundingClientRect().width > 0,
    );
}
