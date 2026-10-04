import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";

export const acceptedExtensions = ["ofx", "qfx", "xlsx"];

export const accountPaymentMethods = [
  "pix",
  "debit_card",
  "cash",
  "boleto",
  "benefits",
  "bank_transfer",
] as const;

export const formatDate = (value: string) => formatDateInBrazil(dateOnlyToSafeInstant(value), {});

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
