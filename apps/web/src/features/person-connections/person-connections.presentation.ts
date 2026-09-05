import { formatDateInBrazil } from "@openmonetis/shared/date-time";

export const activePersonConnectionLabel = "Conta conectada";
export const claimedPersonConnectionInvitationLabel = "Confirmação bilateral";
export const pendingPersonConnectionInvitationLabel = "Convite aguardando acesso";

export function formatPersonConnectionConfirmationExpiry(value: string) {
  return formatDateInBrazil(new Date(value), {
    hour: "2-digit",
    minute: "2-digit",
  });
}
