import {
  account,
  attachments,
  budgets,
  cards,
  categories,
  dashboardPreferences,
  db,
  deviceTokens,
  establishmentLogos,
  externalExpenses,
  financialAccounts,
  importCategoryMappings,
  inboxItems,
  inboxRules,
  installmentAnticipationItems,
  installmentAnticipations,
  installmentSeries,
  invoicePaymentAllocations,
  invoicePayments,
  invoices,
  noteItems,
  notes,
  notificationStates,
  passkey,
  people,
  personConnectionInvitations,
  personConnections,
  personSettlements,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionSplits,
  session,
  transactionAttachments,
  transactionRefunds,
  transactionSplits,
  transactions,
  user,
  userPreferences,
  verification,
} from "@openmonetis/db";
import { and, eq, inArray, isNotNull, notInArray, or } from "drizzle-orm";
import type { SettingsRepository, SettingsResetDraft } from "../services/settings.service";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function clearApplicationDataForUser(transaction: DatabaseTransaction, userId: string) {
  // Connections are bilateral records and survive a reset/account exit in revoked form.
  const connectedPeople = transaction
    .select({ id: personConnections.personId })
    .from(personConnections)
    .where(eq(personConnections.ownerUserId, userId));
  const invitedPeople = transaction
    .select({ id: personConnectionInvitations.personId })
    .from(personConnectionInvitations)
    .where(eq(personConnectionInvitations.ownerUserId, userId));
  await transaction
    .delete(externalExpenses)
    .where(
      or(eq(externalExpenses.ownerUserId, userId), eq(externalExpenses.recipientUserId, userId)),
    );

  await transaction
    .update(personConnections)
    .set({
      status: "revoked",
      revokedAt: new Date(),
      revokedByUserId: userId,
      updatedAt: new Date(),
    })
    .where(
      and(
        or(
          eq(personConnections.ownerUserId, userId),
          eq(personConnections.recipientUserId, userId),
        ),
        eq(personConnections.status, "active"),
      ),
    );
  await transaction
    .update(personConnectionInvitations)
    .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        or(
          eq(personConnectionInvitations.ownerUserId, userId),
          eq(personConnectionInvitations.claimedByUserId, userId),
        ),
        or(
          eq(personConnectionInvitations.status, "pending"),
          eq(personConnectionInvitations.status, "claimed"),
        ),
      ),
    );
  await transaction.delete(inboxItems).where(eq(inboxItems.userId, userId));
  await transaction.delete(inboxRules).where(eq(inboxRules.userId, userId));
  await transaction.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
  await transaction.delete(notificationStates).where(eq(notificationStates.userId, userId));
  await transaction.delete(userPreferences).where(eq(userPreferences.userId, userId));
  await transaction.delete(transactionRefunds).where(eq(transactionRefunds.userId, userId));
  await transaction.delete(personSettlements).where(eq(personSettlements.userId, userId));
  await transaction
    .delete(installmentAnticipationItems)
    .where(eq(installmentAnticipationItems.userId, userId));
  await transaction
    .delete(invoicePaymentAllocations)
    .where(eq(invoicePaymentAllocations.userId, userId));
  await transaction.delete(invoicePayments).where(eq(invoicePayments.userId, userId));
  await transaction.delete(transactionSplits).where(eq(transactionSplits.userId, userId));
  await transaction
    .delete(recurringTransactionSplits)
    .where(eq(recurringTransactionSplits.userId, userId));
  await transaction
    .delete(recurringTransactionOccurrences)
    .where(eq(recurringTransactionOccurrences.userId, userId));
  await transaction.delete(transactionAttachments).where(eq(transactionAttachments.userId, userId));
  await transaction
    .delete(installmentAnticipations)
    .where(eq(installmentAnticipations.userId, userId));
  await transaction.delete(transactions).where(eq(transactions.userId, userId));
  await transaction
    .delete(recurringTransactionRules)
    .where(eq(recurringTransactionRules.userId, userId));
  await transaction.delete(installmentSeries).where(eq(installmentSeries.userId, userId));
  await transaction.delete(invoices).where(eq(invoices.userId, userId));
  await transaction.delete(cards).where(eq(cards.userId, userId));
  await transaction.delete(budgets).where(eq(budgets.userId, userId));
  await transaction.delete(importCategoryMappings).where(eq(importCategoryMappings.userId, userId));
  await transaction.delete(categories).where(eq(categories.userId, userId));
  await transaction.delete(financialAccounts).where(eq(financialAccounts.userId, userId));
  await transaction.delete(attachments).where(eq(attachments.userId, userId));
  await transaction.delete(noteItems).where(eq(noteItems.userId, userId));
  await transaction.delete(notes).where(eq(notes.userId, userId));
  await transaction.delete(establishmentLogos).where(eq(establishmentLogos.userId, userId));
  // Keep people referenced by a connection or invitation. Those rows are part of the bilateral
  // aggregate and are protected by restrictive foreign keys.
  await transaction
    .delete(people)
    .where(
      and(
        eq(people.userId, userId),
        notInArray(people.id, connectedPeople),
        notInArray(people.id, invitedPeople),
      ),
    );
  await transaction
    .update(people)
    .set({
      name: "Pessoa removida",
      email: null,
      avatarUrl: null,
      providerAvatarUrl: null,
      note: null,
      role: "external",
      status: "inactive",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(people.userId, userId),
        or(inArray(people.id, connectedPeople), inArray(people.id, invitedPeople)),
      ),
    );
  await transaction.delete(dashboardPreferences).where(eq(dashboardPreferences.userId, userId));
}

export const settingsRepository = {
  async hasPasswordCredentialForUser(userId) {
    const [credential] = await db
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          eq(account.providerId, "credential"),
          isNotNull(account.password),
        ),
      )
      .limit(1);
    return Boolean(credential);
  },

  async findUserById(userId) {
    const [record] = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        providerAvatarUrl: people.providerAvatarUrl,
      })
      .from(user)
      .leftJoin(people, and(eq(people.userId, user.id), eq(people.role, "admin")))
      .where(eq(user.id, userId))
      .limit(1);
    return record ?? null;
  },

  async listAttachmentFileKeysByUser(userId) {
    const records = await db
      .select({ fileKey: attachments.fileKey })
      .from(attachments)
      .where(eq(attachments.userId, userId));
    return records.map((record) => record.fileKey);
  },

  resetForUser(userId, draft: SettingsResetDraft) {
    return db.transaction(async (transaction) => {
      const [ownedUser] = await transaction
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .for("update");
      if (!ownedUser) return false;

      await clearApplicationDataForUser(transaction, userId);
      await transaction
        .update(user)
        .set({ image: draft.admin.avatarUrl, updatedAt: new Date() })
        .where(eq(user.id, userId));
      await transaction.insert(people).values(draft.admin);
      await transaction.insert(categories).values(draft.categories);
      return true;
    });
  },

  deleteForUser(userId) {
    return db.transaction(async (transaction) => {
      const [ownedUser] = await transaction
        .select({ id: user.id, email: user.email })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1)
        .for("update");
      if (!ownedUser) return false;

      await clearApplicationDataForUser(transaction, userId);
      await transaction.delete(session).where(eq(session.userId, userId));
      await transaction.delete(account).where(eq(account.userId, userId));
      await transaction.delete(passkey).where(eq(passkey.userId, userId));
      await transaction.delete(verification).where(eq(verification.identifier, ownedUser.email));

      // External pending records were removed above. Imported transactions already belong to the
      // recipient, so no bilateral financial row requires an anonymized user tombstone.
      await transaction
        .delete(personConnections)
        .where(
          or(
            eq(personConnections.ownerUserId, userId),
            eq(personConnections.recipientUserId, userId),
          ),
        );
      await transaction
        .delete(personConnectionInvitations)
        .where(
          or(
            eq(personConnectionInvitations.ownerUserId, userId),
            eq(personConnectionInvitations.claimedByUserId, userId),
          ),
        );
      const [deleted] = await transaction
        .delete(user)
        .where(eq(user.id, userId))
        .returning({ id: user.id });
      return Boolean(deleted);
    });
  },
} satisfies SettingsRepository;
