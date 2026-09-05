import {
  db,
  externalExpenses,
  people,
  personConnectionInvitations,
  personConnections,
  user,
} from "@openmonetis/db";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type {
  PersonConnectionInvitationRecord,
  PersonConnectionRecord,
  PersonConnectionsRepository,
} from "../services/person-connections.service";

const ownerUsers = alias(user, "person_connection_owner_users");
const recipientUsers = alias(user, "person_connection_recipient_users");
const claimedUsers = alias(user, "person_connection_claimed_users");

const invitationColumns = {
  id: personConnectionInvitations.id,
  ownerUserId: personConnectionInvitations.ownerUserId,
  ownerName: ownerUsers.name,
  personId: personConnectionInvitations.personId,
  personName: people.name,
  claimedByUserId: personConnectionInvitations.claimedByUserId,
  claimedAccountName: claimedUsers.name,
  tokenDigest: personConnectionInvitations.tokenDigest,
  confirmationCodeDigest: personConnectionInvitations.confirmationCodeDigest,
  confirmationAttempts: personConnectionInvitations.confirmationAttempts,
  status: personConnectionInvitations.status,
  expiresAt: personConnectionInvitations.expiresAt,
  confirmationExpiresAt: personConnectionInvitations.confirmationExpiresAt,
  claimedAt: personConnectionInvitations.claimedAt,
  confirmedAt: personConnectionInvitations.confirmedAt,
  cancelledAt: personConnectionInvitations.cancelledAt,
  createdAt: personConnectionInvitations.createdAt,
  updatedAt: personConnectionInvitations.updatedAt,
};

const connectionColumns = {
  id: personConnections.id,
  invitationId: personConnections.invitationId,
  ownerUserId: personConnections.ownerUserId,
  personId: personConnections.personId,
  personName: people.name,
  recipientUserId: personConnections.recipientUserId,
  recipientName: recipientUsers.name,
  recipientAvatarUrl: recipientUsers.image,
  ownerName: ownerUsers.name,
  ownerAvatarUrl: ownerUsers.image,
  status: personConnections.status,
  connectedAt: personConnections.connectedAt,
  revokedAt: personConnections.revokedAt,
};

function invitationQuery() {
  return db
    .select(invitationColumns)
    .from(personConnectionInvitations)
    .innerJoin(people, eq(personConnectionInvitations.personId, people.id))
    .innerJoin(ownerUsers, eq(personConnectionInvitations.ownerUserId, ownerUsers.id))
    .leftJoin(claimedUsers, eq(personConnectionInvitations.claimedByUserId, claimedUsers.id));
}

function connectionQuery() {
  return db
    .select(connectionColumns)
    .from(personConnections)
    .innerJoin(people, eq(personConnections.personId, people.id))
    .innerJoin(ownerUsers, eq(personConnections.ownerUserId, ownerUsers.id))
    .innerJoin(recipientUsers, eq(personConnections.recipientUserId, recipientUsers.id));
}

export const personConnectionsRepository: PersonConnectionsRepository = {
  async findExternalPersonForUser(personId, userId) {
    const [person] = await db
      .select({ id: people.id, name: people.name })
      .from(people)
      .where(
        and(
          eq(people.id, personId),
          eq(people.userId, userId),
          eq(people.role, "external"),
          eq(people.status, "active"),
        ),
      )
      .limit(1);
    return person ?? null;
  },

  async findActiveConnectionForPerson(personId, ownerUserId) {
    const [record] = await connectionQuery()
      .where(
        and(
          eq(personConnections.personId, personId),
          eq(personConnections.ownerUserId, ownerUserId),
          eq(personConnections.status, "active"),
        ),
      )
      .limit(1);
    return (record as PersonConnectionRecord | undefined) ?? null;
  },

  async expireInvitations(ownerUserId, changedAt) {
    await db
      .update(personConnectionInvitations)
      .set({ status: "expired", updatedAt: changedAt })
      .where(
        and(
          eq(personConnectionInvitations.ownerUserId, ownerUserId),
          inArray(personConnectionInvitations.status, ["pending", "claimed"]),
          sql`${personConnectionInvitations.expiresAt} <= ${changedAt}`,
        ),
      );
  },

  async insertInvitation(input) {
    const [inserted] = await db
      .insert(personConnectionInvitations)
      .values(input)
      .onConflictDoNothing()
      .returning({ id: personConnectionInvitations.id });
    if (!inserted) return null;
    const [record] = await invitationQuery()
      .where(eq(personConnectionInvitations.id, inserted.id))
      .limit(1);
    return record as PersonConnectionInvitationRecord;
  },

  async listInvitationsForOwner(ownerUserId) {
    return (await invitationQuery().where(
      eq(personConnectionInvitations.ownerUserId, ownerUserId),
    )) as PersonConnectionInvitationRecord[];
  },

  async findInvitationForOwner(id, ownerUserId) {
    const [record] = await invitationQuery()
      .where(
        and(
          eq(personConnectionInvitations.id, id),
          eq(personConnectionInvitations.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    return (record as PersonConnectionInvitationRecord | undefined) ?? null;
  },

  async claimInvitation(input) {
    const invitationId = await db.transaction(async (transaction) => {
      const [current] = await transaction
        .select({
          id: personConnectionInvitations.id,
          ownerUserId: personConnectionInvitations.ownerUserId,
        })
        .from(personConnectionInvitations)
        .where(
          and(
            eq(personConnectionInvitations.tokenDigest, input.tokenDigest),
            eq(personConnectionInvitations.status, "pending"),
            sql`${personConnectionInvitations.expiresAt} > ${input.claimedAt}`,
          ),
        )
        .for("update")
        .limit(1);
      if (!current || current.ownerUserId === input.recipientUserId) return null;
      const [updatedRecord] = await transaction
        .update(personConnectionInvitations)
        .set({
          claimedByUserId: input.recipientUserId,
          confirmationCodeDigest: input.confirmationCodeDigest,
          confirmationAttempts: 0,
          status: "claimed",
          claimedAt: input.claimedAt,
          confirmationExpiresAt: input.confirmationExpiresAt,
          updatedAt: input.claimedAt,
        })
        .where(
          and(
            eq(personConnectionInvitations.id, current.id),
            eq(personConnectionInvitations.status, "pending"),
          ),
        )
        .returning({ id: personConnectionInvitations.id });
      return (updatedRecord as { id: string }).id;
    });
    if (!invitationId) return null;
    const [record] = await invitationQuery()
      .where(eq(personConnectionInvitations.id, invitationId))
      .limit(1);
    return record as PersonConnectionInvitationRecord;
  },

  async incrementConfirmationAttempts(id, ownerUserId) {
    await db
      .update(personConnectionInvitations)
      .set({ confirmationAttempts: sql`${personConnectionInvitations.confirmationAttempts} + 1` })
      .where(
        and(
          eq(personConnectionInvitations.id, id),
          eq(personConnectionInvitations.ownerUserId, ownerUserId),
          eq(personConnectionInvitations.status, "claimed"),
        ),
      );
  },

  async confirmInvitation(input) {
    const connectionId = await db.transaction(async (transaction) => {
      const [invitation] = await transaction
        .select()
        .from(personConnectionInvitations)
        .where(
          and(
            eq(personConnectionInvitations.id, input.id),
            eq(personConnectionInvitations.ownerUserId, input.ownerUserId),
            eq(personConnectionInvitations.status, "claimed"),
            sql`${personConnectionInvitations.confirmationExpiresAt} > ${input.confirmedAt}`,
            sql`${personConnectionInvitations.confirmationAttempts} < ${input.maximumAttempts}`,
          ),
        )
        .for("update")
        .limit(1);
      if (!invitation?.claimedByUserId) return null;
      const [connectionRecord] = await transaction
        .insert(personConnections)
        .values({
          invitationId: invitation.id,
          ownerUserId: invitation.ownerUserId,
          personId: invitation.personId,
          recipientUserId: invitation.claimedByUserId,
          connectedAt: input.confirmedAt,
        })
        .onConflictDoNothing()
        .returning({ id: personConnections.id });
      const connection = connectionRecord as { id: string };
      await transaction
        .update(personConnectionInvitations)
        .set({ status: "confirmed", confirmedAt: input.confirmedAt, updatedAt: input.confirmedAt })
        .where(eq(personConnectionInvitations.id, invitation.id));
      return connection.id;
    });
    if (!connectionId) return null;
    const [record] = await connectionQuery().where(eq(personConnections.id, connectionId)).limit(1);
    return record as PersonConnectionRecord;
  },

  async cancelInvitation(input) {
    const [updated] = await db
      .update(personConnectionInvitations)
      .set({ status: "cancelled", cancelledAt: input.cancelledAt, updatedAt: input.cancelledAt })
      .where(
        and(
          eq(personConnectionInvitations.id, input.id),
          eq(personConnectionInvitations.ownerUserId, input.ownerUserId),
          inArray(personConnectionInvitations.status, ["pending", "claimed"]),
        ),
      )
      .returning({ id: personConnectionInvitations.id });
    if (!updated) return null;
    const [record] = await invitationQuery()
      .where(eq(personConnectionInvitations.id, updated.id))
      .limit(1);
    return record as PersonConnectionInvitationRecord;
  },

  async listConnectionsForUser(userId) {
    return (await connectionQuery().where(
      or(eq(personConnections.ownerUserId, userId), eq(personConnections.recipientUserId, userId)),
    )) as PersonConnectionRecord[];
  },

  async revokeConnection(input) {
    const connectionId = await db.transaction(async (transaction) => {
      const [updated] = await transaction
        .update(personConnections)
        .set({
          status: "revoked",
          revokedAt: input.revokedAt,
          revokedByUserId: input.userId,
          updatedAt: input.revokedAt,
        })
        .where(
          and(
            eq(personConnections.id, input.id),
            eq(personConnections.status, "active"),
            or(
              eq(personConnections.ownerUserId, input.userId),
              eq(personConnections.recipientUserId, input.userId),
            ),
          ),
        )
        .returning({ id: personConnections.id });
      if (!updated) return null;
      await transaction
        .delete(externalExpenses)
        .where(
          and(
            eq(externalExpenses.connectionId, updated.id),
            eq(externalExpenses.status, "pending"),
          ),
        );
      return updated.id;
    });
    if (!connectionId) return null;
    const [record] = await connectionQuery().where(eq(personConnections.id, connectionId)).limit(1);
    return record as PersonConnectionRecord;
  },
};
