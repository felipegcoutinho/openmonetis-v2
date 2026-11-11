const pageTitleSelector = "main h1";

function findVisiblePageTitle() {
  // Some pages render breakpoint-specific titles and hide the inactive one with display: none.
  return Array.from(document.querySelectorAll<HTMLElement>(pageTitleSelector)).find(
    (title) => title.getClientRects().length > 0,
  );
}

function focusPageTitle() {
  const title = findVisiblePageTitle();
  if (!title) return;
  if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
  title.focus();
}

export function SkipToContent() {
  return (
    <button
      className="sr-only z-60 rounded-md bg-background px-4 py-2 font-medium text-foreground text-sm shadow-lg ring-2 ring-ring focus-visible:not-sr-only focus-visible:fixed focus-visible:top-2 focus-visible:left-2"
      onClick={focusPageTitle}
      type="button"
    >
      Pular para o conteúdo
    </button>
  );
}
