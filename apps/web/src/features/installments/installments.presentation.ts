import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type { ListInstallmentsQuery } from "@openmonetis/validators/installments";

type InstallmentsSearch = {
  period?: string;
  status?: ListInstallmentsQuery["status"];
};

export function validateInstallmentsSearch(search: Record<string, unknown>): InstallmentsSearch {
  return {
    period:
      typeof search.period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.period)
        ? search.period
        : undefined,
    status:
      search.status === "open" || search.status === "completed" || search.status === "all"
        ? search.status
        : undefined,
  };
}

export function resolveInstallmentsSearch(search: InstallmentsSearch): ListInstallmentsQuery {
  return {
    period: search.period ?? getCurrentPeriod(),
    status: search.status ?? "open",
  };
}

export function formatInstallmentPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
    month: "long",
    year: "numeric",
  });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

export function formatInstallmentChartPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
    month: "short",
    year: "numeric",
  })
    .replaceAll(".", "")
    .replace(" de ", " ");
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
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
  completed: "Concluída",
  incomplete: "Cronograma incompleto",
} as const;

function getCurrentPeriod() {
  return getCurrentPeriodInBrazil();
}
