import { aiDiagnoses, db } from "@openmonetis/db";
import { and, count, desc, eq, gte } from "drizzle-orm";
import type { AiDiagnosesRepository, AiDiagnosisRecord } from "../services/ai-diagnoses.service";

const diagnosisColumns = {
  id: aiDiagnoses.id,
  userId: aiDiagnoses.userId,
  period: aiDiagnoses.period,
  provider: aiDiagnoses.provider,
  requestedModel: aiDiagnoses.requestedModel,
  sharedScopes: aiDiagnoses.sharedScopes,
  voice: aiDiagnoses.voice,
  modelId: aiDiagnoses.modelId,
  modelName: aiDiagnoses.modelName,
  status: aiDiagnoses.status,
  failureCode: aiDiagnoses.failureCode,
  health: aiDiagnoses.health,
  result: aiDiagnoses.result,
  createdAt: aiDiagnoses.createdAt,
  completedAt: aiDiagnoses.completedAt,
};

type DiagnosisRow = { modelId: string | null; modelName: string | null } & Omit<
  AiDiagnosisRecord,
  "model"
>;

function toRecord({ modelId, modelName, ...row }: DiagnosisRow): AiDiagnosisRecord {
  return { ...row, model: modelId ? { id: modelId, name: modelName ?? modelId } : null };
}

function pendingFor(id: string, userId: string) {
  return and(
    eq(aiDiagnoses.id, id),
    eq(aiDiagnoses.userId, userId),
    eq(aiDiagnoses.status, "pending"),
  );
}

export const aiDiagnosesRepository = {
  async insertPending(data) {
    const [record] = await db.insert(aiDiagnoses).values(data).returning(diagnosisColumns);
    if (!record) throw new Error("AI diagnosis insert returned no row");
    return toRecord(record);
  },

  async findByIdForUser(id, userId) {
    const [record] = await db
      .select(diagnosisColumns)
      .from(aiDiagnoses)
      .where(and(eq(aiDiagnoses.id, id), eq(aiDiagnoses.userId, userId)))
      .limit(1);
    return record ? toRecord(record) : null;
  },

  async findPendingByUser(userId) {
    const [record] = await db
      .select(diagnosisColumns)
      .from(aiDiagnoses)
      .where(and(eq(aiDiagnoses.userId, userId), eq(aiDiagnoses.status, "pending")))
      .orderBy(desc(aiDiagnoses.createdAt))
      .limit(1);
    return record ? toRecord(record) : null;
  },

  async listRecentByUser(userId, limit) {
    const rows = await db
      .select(diagnosisColumns)
      .from(aiDiagnoses)
      .where(eq(aiDiagnoses.userId, userId))
      .orderBy(desc(aiDiagnoses.createdAt), desc(aiDiagnoses.id))
      .limit(limit);
    return rows.map(toRecord);
  },

  async countCreatedSince(userId, since) {
    const [row] = await db
      .select({ value: count() })
      .from(aiDiagnoses)
      .where(and(eq(aiDiagnoses.userId, userId), gte(aiDiagnoses.createdAt, since)));
    return row?.value ?? 0;
  },

  async completePending(id, userId, result, model, completedAt) {
    const [record] = await db
      .update(aiDiagnoses)
      .set({
        status: "completed",
        result,
        modelId: model?.id ?? null,
        modelName: model?.name ?? null,
        completedAt,
      })
      .where(pendingFor(id, userId))
      .returning(diagnosisColumns);
    return record ? toRecord(record) : null;
  },

  async failPending(id, userId, failureCode, completedAt) {
    const [record] = await db
      .update(aiDiagnoses)
      .set({ status: "failed", failureCode, completedAt })
      .where(pendingFor(id, userId))
      .returning(diagnosisColumns);
    return record ? toRecord(record) : null;
  },

  async deleteForUser(id, userId) {
    const rows = await db
      .delete(aiDiagnoses)
      .where(and(eq(aiDiagnoses.id, id), eq(aiDiagnoses.userId, userId)))
      .returning({ id: aiDiagnoses.id });
    return rows.length > 0;
  },
} satisfies AiDiagnosesRepository;
