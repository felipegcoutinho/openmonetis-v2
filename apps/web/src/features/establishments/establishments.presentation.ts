import { createEstablishmentInitials } from "@openmonetis/domain/establishments";
export function getEstablishmentInitials(name: string) {
  return createEstablishmentInitials(name);
}
