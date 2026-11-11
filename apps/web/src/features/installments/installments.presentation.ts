import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";

export type InstallmentsSearch = {
  /** Card filter applied to the list only; `all` keeps every payment method. */
  card: string;
  q: string;
};

/** What the URL carries: values equal to the defaults are omitted to keep links short. */
export type InstallmentsSearchParams = Partial<InstallmentsSearch>;

const defaultInstallmentsSearch: InstallmentsSearch = { card: "all", q: "" };
const MAX_SEARCH_LENGTH = 160;

/** Old links may still carry `period` or `status`; the report ignores both, so they are dropped. */
export function validateInstallmentsSearch(
  search: Record<string, unknown>,
): InstallmentsSearchParams {
  return compactInstallmentsSearch({
    card:
      typeof search.card === "string" && search.card.length > 0
        ? search.card
        : defaultInstallmentsSearch.card,
    q: typeof search.q === "string" ? search.q.slice(0, MAX_SEARCH_LENGTH) : "",
  });
}

export function resolveInstallmentsSearch(search: InstallmentsSearchParams): InstallmentsSearch {
  // Compacted params keep their keys with `undefined`, so spreading would erase the defaults.
  return {
    card: search.card ?? defaultInstallmentsSearch.card,
    q: search.q ?? defaultInstallmentsSearch.q,
  };
}

export function compactInstallmentsSearch(search: InstallmentsSearch): InstallmentsSearchParams {
  return {
    card: search.card === defaultInstallmentsSearch.card ? undefined : search.card,
    q: search.q || undefined,
  };
}

export function formatInstallmentEndPeriod(period: string) {
  const formatted = formatDateInBrazil(periodToSafeInstant(period), {
    month: "short",
    year: "numeric",
  });
  const label = `${formatted.charAt(0).toLocaleUpperCase("pt-BR")}${formatted.slice(1)}`;

  return `Até ${label}`;
}

export function formatInstallmentDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replaceAll(".", "");
}

export const installmentPaymentMethodLabels = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  boleto: "Boleto",
  benefits: "Benefícios",
  bank_transfer: "Transferência bancária",
} as const;

export const installmentSeriesStatusLabels = {
  open: "Em andamento",
  completed: "Quitada",
  incomplete: "Cronograma incompleto",
} as const;

/** Chart tokens for the simulations, kept apart from the brand color of real installments. */
export const realInstallmentsColor = "var(--brand)";
export const payoffSeriesColor = "var(--teal)";
/** Payoff selection takes the simulation's teal instead of the brand color. */
export const payoffCheckboxClassName =
  "data-checked:border-teal data-checked:bg-teal data-checked:text-background data-indeterminate:border-teal data-indeterminate:bg-teal data-indeterminate:text-background";
export const purchaseSimulationColor = "var(--info)";

/** Parses the discount typed for a purchase payoff ("12,5" or "1250.00") into a number. */
export function parseDiscountInput(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
}

export function getPayoffSimulationErrorMessage(code: string | undefined) {
  if (code === "validation_error") return "Revise o desconto: em %, use até 100.";
  return "Não foi possível simular a quitação. Tente novamente.";
}
