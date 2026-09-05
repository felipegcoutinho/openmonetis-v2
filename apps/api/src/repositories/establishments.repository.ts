import { db, establishmentLogos } from "@openmonetis/db";
import { and, eq } from "drizzle-orm";
import type { EstablishmentsRepository } from "../services/establishments.service";

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
    await db
      .insert(establishmentLogos)
      .values({ userId, nameKey, domain })
      .onConflictDoUpdate({
        target: [establishmentLogos.userId, establishmentLogos.nameKey],
        set: { domain, updatedAt: new Date() },
      });
  },
  async removeLogoDomain(userId, nameKey) {
    await db
      .delete(establishmentLogos)
      .where(and(eq(establishmentLogos.userId, userId), eq(establishmentLogos.nameKey, nameKey)));
  },
};
