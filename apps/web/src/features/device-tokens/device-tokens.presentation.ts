import { formatDateInBrazil } from "@openmonetis/shared/date-time";

export function formatDeviceTokenDate(value: string) {
  return formatDateInBrazil(new Date(value), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).replace(" de ", " ");
}

export function formatDeviceTokenLastUsed(value: string | null) {
  if (!value) return "Ainda não usado";
  return `Usado em ${formatDeviceTokenDate(value)}`;
}

export function formatDeviceTokenQrCodeValue(token: string) {
  return `openmonetis://companion/token?v=1&token=${encodeURIComponent(token)}`;
}
