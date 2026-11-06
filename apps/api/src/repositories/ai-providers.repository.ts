import { aiProviderConnections, db } from "@openmonetis/db";
import { and, eq } from "drizzle-orm";
import type { AiProvidersRepository } from "../services/ai-providers.service";

export const aiProvidersRepository = {
  async listByUser(userId) {
    return db
      .select({
        provider: aiProviderConnections.provider,
        consentedAt: aiProviderConnections.consentedAt,
        preferredModel: aiProviderConnections.preferredModel,
      })
      .from(aiProviderConnections)
      .where(eq(aiProviderConnections.userId, userId));
  },

  async saveConsent(userId, provider, consentedAt) {
    await db
      .insert(aiProviderConnections)
      .values({ userId, provider, consentedAt })
      .onConflictDoUpdate({
        target: [aiProviderConnections.userId, aiProviderConnections.provider],
        set: { consentedAt },
      });
  },

  async savePreferredModel(userId, provider, preferredModel) {
    const rows = await db
      .update(aiProviderConnections)
      .set({ preferredModel })
      .where(
        and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, provider)),
      )
      .returning({ id: aiProviderConnections.id });
    return rows.length > 0;
  },

  async deleteForUser(userId, provider) {
    await db
      .delete(aiProviderConnections)
      .where(
        and(eq(aiProviderConnections.userId, userId), eq(aiProviderConnections.provider, provider)),
      );
  },
} satisfies AiProvidersRepository;
