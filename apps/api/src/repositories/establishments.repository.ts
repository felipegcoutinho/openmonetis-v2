import { db, establishmentLogos, externalExpenses } from "@openmonetis/db";
import { createEstablishmentNameKey } from "@openmonetis/domain/establishments";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { EstablishmentsRepository } from "../services/establishments.service";

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function synchronizePendingSharedLogo(
  transaction: DatabaseTransaction,
  userId: string,
  nameKey: string,
  domain: string | null,
) {
  const pending = await transaction
    .select({ id: externalExpenses.id, name: externalExpenses.name })
    .from(externalExpenses)
    .where(and(eq(externalExpenses.ownerUserId, userId), eq(externalExpenses.status, "pending")));
  const ids = pending.flatMap((item) =>
    createEstablishmentNameKey(item.name) === nameKey ? [item.id] : [],
  );
  if (!ids.length) return;

  await transaction
    .update(externalExpenses)
    .set({
      establishmentLogoDomain: domain,
      sourceVersion: sql`${externalExpenses.sourceVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(inArray(externalExpenses.id, ids));
}

export const establishmentsRepository: EstablishmentsRepository = {
  async findLogoDomain(userId, nameKey) {
    const [row] = await db
      .select({ domain: establishmentLogos.domain })
      .from(establishmentLogos)
      .where(and(eq(establishmentLogos.userId, userId), eq(establishmentLogos.nameKey, nameKey)))
      .limit(1);
    return row?.domain ?? null;
  },
  async saveLogoDomain(userId, nameKey, domain) {
    await db.transaction(async (transaction) => {
      await transaction
        .insert(establishmentLogos)
        .values({ userId, nameKey, domain })
        .onConflictDoUpdate({
          target: [establishmentLogos.userId, establishmentLogos.nameKey],
          set: { domain, updatedAt: new Date() },
        });
      await synchronizePendingSharedLogo(transaction, userId, nameKey, domain);
    });
  },
  async removeLogoDomain(userId, nameKey) {
    await db.transaction(async (transaction) => {
      await transaction
        .delete(establishmentLogos)
        .where(and(eq(establishmentLogos.userId, userId), eq(establishmentLogos.nameKey, nameKey)));
      await synchronizePendingSharedLogo(transaction, userId, nameKey, null);
    });
  },
};
