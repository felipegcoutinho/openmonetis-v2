/**
 * Labelled action in a card footer ("Editar", "Extrato", "Aportar"…), the same in every card. On
 * a desktop it reads as a link in the brand colour. On a phone, inside a card marked
 * `data-mobile-entity-card`, the footer lays its actions out as equal 44px buttons on a muted fill,
 * with `CardActionsMenu` as a square at the end (`styles/mobile-forms.css`).
 */
export const cardFooterActionClassName =
  "-mx-1 inline-flex h-8 items-center gap-1.5 rounded-md px-2 font-medium text-brand-strong text-sm transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring active:bg-(--pressed) disabled:opacity-50";
