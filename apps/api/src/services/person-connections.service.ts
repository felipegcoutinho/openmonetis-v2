import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  assertPersonConnectionInvitationTransition,
  isPersonConnectionConfirmationExpired,
  isPersonConnectionInvitationExpired,
  type PersonConnectionInvitationStatus,
  type PersonConnectionStatus,
  type PersonConnectionTransitionError,
  personConnectionConfirmationLifetimeMinutes,
  personConnectionConfirmationMaximumAttempts,
  personConnectionInvitationLifetimeHours,
} from "@openmonetis/domain/person-connections";
import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  ClaimedPersonConnectionInvitationOutput,
  ConfirmPersonConnectionInput,
  CreatedPersonConnectionInvitationOutput,
  PersonConnectionInvitationOutput,
  PersonConnectionOutput,
} from "@openmonetis/validators/person-connections";
import { badRequest, conflict, notFound } from "../utils/errors";

export type PersonConnectionInvitationRecord = {
  id: string;
  ownerUserId: string;
  ownerName: string;
  personId: string;
  personName: string;
  claimedByUserId: string | null;
  claimedAccountName: string | null;
  tokenDigest: string;
  confirmationCodeDigest: string | null;
  confirmationAttempts: number;
  status: PersonConnectionInvitationStatus;
  expiresAt: Date;
  confirmationExpiresAt: Date | null;
  claimedAt: Date | null;
  confirmedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonConnectionRecord = {
  id: string;
  invitationId: string;
  ownerUserId: string;
  personId: string;
  personName: string;
  recipientUserId: string;
  recipientName: string;
  recipientAvatarUrl: string | null;
  ownerName: string;
  ownerAvatarUrl: string | null;
  status: PersonConnectionStatus;
  connectedAt: Date;
  revokedAt: Date | null;
};

export type PersonConnectionsRepository = {
  findExternalPersonForUser(
    personId: string,
    userId: string,
  ): Promise<{ id: string; name: string } | null>;
  findActiveConnectionForPerson(
    personId: string,
    ownerUserId: string,
  ): Promise<PersonConnectionRecord | null>;
  expireInvitations(ownerUserId: string, changedAt: Date): Promise<void>;
  insertInvitation(input: {
    ownerUserId: string;
    personId: string;
    tokenDigest: string;
    expiresAt: Date;
  }): Promise<PersonConnectionInvitationRecord | null>;
  listInvitationsForOwner(ownerUserId: string): Promise<PersonConnectionInvitationRecord[]>;
  findInvitationForOwner(
    id: string,
    ownerUserId: string,
  ): Promise<PersonConnectionInvitationRecord | null>;
  claimInvitation(input: {
    tokenDigest: string;
    recipientUserId: string;
    confirmationCodeDigest: string;
    claimedAt: Date;
    confirmationExpiresAt: Date;
  }): Promise<PersonConnectionInvitationRecord | null>;
  incrementConfirmationAttempts(id: string, ownerUserId: string): Promise<void>;
  confirmInvitation(input: {
    id: string;
    ownerUserId: string;
    maximumAttempts: number;
    confirmedAt: Date;
  }): Promise<PersonConnectionRecord | null>;
  cancelInvitation(input: {
    id: string;
    ownerUserId: string;
    cancelledAt: Date;
  }): Promise<PersonConnectionInvitationRecord | null>;
  listConnectionsForUser(userId: string): Promise<PersonConnectionRecord[]>;
  revokeConnection(input: {
    id: string;
    userId: string;
    revokedAt: Date;
  }): Promise<PersonConnectionRecord | null>;
};

export function createPersonConnectionsService(
  repository: PersonConnectionsRepository,
  options: {
    secret: string;
    now?: () => Date;
    synchronizeRecurringExternalExpenses?: (
      ownerUserId: string,
      period: string,
    ) => Promise<unknown>;
  },
) {
  const now = options.now ?? (() => new Date());

  return {
    async createInvitation(
      personId: string,
      ownerUserId: string,
    ): Promise<CreatedPersonConnectionInvitationOutput> {
      const person = await repository.findExternalPersonForUser(personId, ownerUserId);
      if (!person) throw notFound("Person not found", "person_not_found");
      const createdAt = now();
      await repository.expireInvitations(ownerUserId, createdAt);
      if (await repository.findActiveConnectionForPerson(personId, ownerUserId)) {
        throw conflict("The person already has a connected account", "person_already_connected");
      }

      const token = randomBytes(32).toString("base64url");
      const invitation = await repository.insertInvitation({
        ownerUserId,
        personId,
        tokenDigest: digestToken(token),
        expiresAt: addHours(createdAt, personConnectionInvitationLifetimeHours),
      });
      if (!invitation) {
        throw conflict("The person already has a pending invitation", "invitation_already_pending");
      }
      return { ...toInvitationOutput(invitation), token };
    },

    async listInvitations(ownerUserId: string): Promise<PersonConnectionInvitationOutput[]> {
      await repository.expireInvitations(ownerUserId, now());
      return (await repository.listInvitationsForOwner(ownerUserId)).map(toInvitationOutput);
    },

    async claimInvitation(
      token: string,
      recipientUserId: string,
    ): Promise<ClaimedPersonConnectionInvitationOutput> {
      const claimedAt = now();
      const confirmationCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const invitation = await repository.claimInvitation({
        tokenDigest: digestToken(token),
        recipientUserId,
        confirmationCodeDigest: digestConfirmation(options.secret, confirmationCode),
        claimedAt,
        confirmationExpiresAt: addMinutes(claimedAt, personConnectionConfirmationLifetimeMinutes),
      });
      if (!invitation) {
        throw badRequest("The invitation is invalid or expired", "invitation_invalid");
      }
      if (invitation.ownerUserId === recipientUserId) {
        throw badRequest("You cannot connect your own account", "self_connection_not_allowed");
      }
      return {
        invitationId: invitation.id,
        ownerName: invitation.ownerName,
        personName: invitation.personName,
        confirmationCode,
        confirmationExpiresAt:
          invitation.confirmationExpiresAt?.toISOString() ?? claimedAt.toISOString(),
      };
    },

    async confirmInvitation(
      id: string,
      ownerUserId: string,
      input: ConfirmPersonConnectionInput,
    ): Promise<PersonConnectionOutput> {
      const invitation = await repository.findInvitationForOwner(id, ownerUserId);
      if (!invitation) throw notFound("Invitation not found", "invitation_not_found");
      try {
        assertPersonConnectionInvitationTransition(invitation.status, "confirmed");
      } catch (error) {
        const transitionError = error as PersonConnectionTransitionError;
        throw conflict("The invitation cannot be confirmed", transitionError.code);
      }
      const currentTime = now();
      if (
        isPersonConnectionInvitationExpired(invitation.expiresAt, currentTime) ||
        isPersonConnectionConfirmationExpired(invitation.confirmationExpiresAt, currentTime)
      ) {
        throw conflict("The confirmation code expired", "confirmation_expired");
      }
      if (invitation.confirmationAttempts >= personConnectionConfirmationMaximumAttempts) {
        throw conflict("The confirmation code is locked", "confirmation_locked");
      }
      const expected = invitation.confirmationCodeDigest;
      const provided = digestConfirmation(options.secret, input.confirmationCode);
      if (!expected || !safeEqual(expected, provided)) {
        await repository.incrementConfirmationAttempts(id, ownerUserId);
        throw badRequest("The confirmation code is invalid", "confirmation_code_invalid");
      }
      const connection = await repository.confirmInvitation({
        id,
        ownerUserId,
        maximumAttempts: personConnectionConfirmationMaximumAttempts,
        confirmedAt: currentTime,
      });
      if (!connection) {
        throw conflict("The invitation changed. Reload and try again", "invitation_state_conflict");
      }
      try {
        await options.synchronizeRecurringExternalExpenses?.(
          ownerUserId,
          getCurrentPeriodInBrazil(currentTime),
        );
      } catch (error) {
        console.error("recurring_external_expense_sync_failed", {
          ownerUserId,
          period: getCurrentPeriodInBrazil(currentTime),
          error,
        });
      }
      return toConnectionOutput(connection, ownerUserId);
    },

    async cancelInvitation(id: string, ownerUserId: string) {
      const invitation = await repository.findInvitationForOwner(id, ownerUserId);
      if (!invitation) throw notFound("Invitation not found", "invitation_not_found");
      if (invitation.status !== "pending" && invitation.status !== "claimed") {
        throw conflict("The invitation cannot be cancelled", "invitation_state_conflict");
      }
      const cancelled = await repository.cancelInvitation({ id, ownerUserId, cancelledAt: now() });
      if (!cancelled) throw conflict("The invitation changed", "invitation_state_conflict");
      return toInvitationOutput(cancelled);
    },

    async listConnections(userId: string): Promise<PersonConnectionOutput[]> {
      return (await repository.listConnectionsForUser(userId)).map((record) =>
        toConnectionOutput(record, userId),
      );
    },

    async revokeConnection(id: string, userId: string): Promise<PersonConnectionOutput> {
      const connection = await repository.revokeConnection({ id, userId, revokedAt: now() });
      if (!connection) throw notFound("Connection not found", "connection_not_found");
      return toConnectionOutput(connection, userId);
    },
  };
}

function digestToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function digestConfirmation(secret: string, value: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1_000);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1_000);
}

function toInvitationOutput(
  invitation: PersonConnectionInvitationRecord,
): PersonConnectionInvitationOutput {
  return {
    id: invitation.id,
    personId: invitation.personId,
    personName: invitation.personName,
    status: invitation.status,
    claimedAccountName: invitation.claimedAccountName,
    expiresAt: invitation.expiresAt.toISOString(),
    confirmationExpiresAt: invitation.confirmationExpiresAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

function toConnectionOutput(
  record: PersonConnectionRecord,
  userId: string,
): PersonConnectionOutput {
  const owner = record.ownerUserId === userId;
  return {
    id: record.id,
    invitationId: record.invitationId,
    personId: owner ? record.personId : null,
    perspective: owner ? "owner" : "recipient",
    status: record.status,
    counterpartName: owner ? record.recipientName : record.ownerName,
    counterpartAvatarUrl: owner ? record.recipientAvatarUrl : record.ownerAvatarUrl,
    connectedAt: record.connectedAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
  };
}

export type PersonConnectionsService = ReturnType<typeof createPersonConnectionsService>;
