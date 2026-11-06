import { formatDateInBrazil, periodToSafeInstant } from "@openmonetis/shared/date-time";

/**
 * "Novembro de 2026": the month spelled out, capitalized for headings and labels. `short` gives
 * "Nov 2026" for chart axes and compact lists.
 */
export function formatPeriod(period: string, short = false) {
  let label = formatDateInBrazil(periodToSafeInstant(period), {
    month: short ? "short" : "long",
    year: "numeric",
  }).replaceAll(".", "");
  if (short) label = label.replace(" de ", " ");
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}
