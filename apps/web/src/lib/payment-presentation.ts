import { dateOnlyToSafeInstant, formatDateToPartsInBrazil } from "@openmonetis/shared/date-time";

export function formatRecordedPaymentDate(value: string) {
  const parts = formatDateToPartsInBrazil(dateOnlyToSafeInstant(value), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const capitalizedMonth = month.charAt(0).toLocaleUpperCase("pt-BR") + month.slice(1);
  return `Pago em ${day} de ${capitalizedMonth} ${year}`;
}
