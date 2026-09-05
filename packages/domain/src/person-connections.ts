export const personConnectionInvitationStatuses = [
  "pending",
  "claimed",
  "confirmed",
  "cancelled",
  "expired",
] as const;

export const personConnectionStatuses = ["active", "revoked"] as const;

export type PersonConnectionInvitationStatus = (typeof personConnectionInvitationStatuses)[number];
export type PersonConnectionStatus = (typeof personConnectionStatuses)[number];

export const personConnectionInvitationLifetimeHours = 24;
export const personConnectionConfirmationLifetimeMinutes = 15;
export const personConnectionConfirmationMaximumAttempts = 5;
export const personConnectionConfirmationCodeLength = 6;

export class PersonConnectionTransitionError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PersonConnectionTransitionError";
  }
}

export function assertPersonConnectionInvitationTransition(
  current: PersonConnectionInvitationStatus,
  target: PersonConnectionInvitationStatus,
) {
  const allowed: Record<PersonConnectionInvitationStatus, PersonConnectionInvitationStatus[]> = {
    pending: ["claimed", "cancelled", "expired"],
    claimed: ["confirmed", "cancelled", "expired"],
    confirmed: [],
    cancelled: [],
    expired: [],
  };

  if (!allowed[current].includes(target)) {
    throw new PersonConnectionTransitionError("person_connection_state_conflict");
  }
}

export function isPersonConnectionInvitationExpired(expiresAt: Date, now: Date) {
  return expiresAt.getTime() <= now.getTime();
}

export function isPersonConnectionConfirmationExpired(
  confirmationExpiresAt: Date | null,
  now: Date,
) {
  return !confirmationExpiresAt || confirmationExpiresAt.getTime() <= now.getTime();
}
