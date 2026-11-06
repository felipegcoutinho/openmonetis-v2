import { z } from "@hono/zod-openapi";
import {
  aiDiagnosisActionKinds,
  aiDiagnosisChartKinds,
  aiDiagnosisFailureCodes,
  aiDiagnosisMaximumSections,
  aiDiagnosisSectionTones,
  aiDiagnosisStatuses,
  aiDiagnosisVoices,
  financialHealthLevels,
} from "@openmonetis/domain/ai-diagnoses";
import { aiProviders } from "@openmonetis/domain/ai-providers";
import { toJSONSchema } from "zod";
import { AiDataScopeSchema } from "./ai-data-sharing";
import { AiProviderModelIdSchema } from "./ai-providers";

const periodSchema = z.string().regex(/^[1-9]\d{3}-(0[1-9]|1[0-2])$/);
const nullablePercentSchema = z.number().finite().nullable();

export const CreateAiDiagnosisInputSchema = z
  .object({
    period: periodSchema,
    provider: z.enum(aiProviders),
    /** Omitted or `null` uses the provider's preferred model, then the plan default. */
    model: AiProviderModelIdSchema.nullable().optional(),
    /** Writing style from a closed list; omitted uses the balanced voice. Never free text. */
    voice: z.enum(aiDiagnosisVoices).optional(),
  })
  .strict()
  .openapi("CreateAiDiagnosisInput");

const usedModelSchema = z.object({ id: z.string(), name: z.string() });

export const AiDiagnosisParamsSchema = z
  .object({ id: z.uuid().openapi({ param: { name: "id", in: "path" } }) })
  .openapi("AiDiagnosisParams");

/**
 * What the model must answer. It only writes text and picks from closed catalogs; every number
 * shown to the user comes from the financial health calculated by the API.
 */
export const AiDiagnosisModelOutputSchema = z
  .object({
    headline: z.string().trim().min(1).max(200),
    summary: z.string().trim().min(1).max(1500),
    sections: z
      .array(
        z
          .object({
            title: z.string().trim().min(1).max(100),
            body: z.string().trim().min(1).max(2000),
            tone: z.enum(aiDiagnosisSectionTones),
          })
          .strict(),
      )
      .min(1)
      .max(aiDiagnosisMaximumSections),
    charts: z.array(z.enum(aiDiagnosisChartKinds)).max(aiDiagnosisChartKinds.length),
    actions: z
      .array(
        z
          .object({
            kind: z.enum(aiDiagnosisActionKinds),
            label: z.string().trim().min(1).max(80),
            reason: z.string().trim().min(1).max(300),
            categoryId: z.string().nullable(),
          })
          .strict(),
      )
      .max(8),
  })
  .strict();

/**
 * JSON Schema handed to the provider CLIs for structured output. Length limits stay in Zod only:
 * some providers reject string length keywords in strict schemas.
 */
export function createAiDiagnosisModelOutputJsonSchema() {
  return stripKeywords(toJSONSchema(AiDiagnosisModelOutputSchema), [
    "$schema",
    "minLength",
    "maxLength",
  ]);
}

const healthMonthSchema = z.object({
  period: periodSchema,
  income: z.number().finite(),
  expenses: z.number().finite(),
});

export const FinancialHealthOutputSchema = z
  .object({
    score: z.number().int().min(0).max(100),
    level: z.enum(financialHealthLevels),
    indicators: z.object({
      savingsRate: nullablePercentSchema,
      averageSavingsRate: nullablePercentSchema,
      averageMonthlyExpenses: z.number().finite().nullable(),
      emergencyFundMonths: z.number().finite().nullable(),
      expenseTrend: nullablePercentSchema,
      topCategoryShare: nullablePercentSchema,
      criticalAttentionItems: z.number().int().nonnegative(),
      warningAttentionItems: z.number().int().nonnegative(),
    }),
    charts: z.object({
      incomeExpenseHistory: z.array(healthMonthSchema),
      savingsRateHistory: z.array(
        z.object({ period: periodSchema, savingsRate: nullablePercentSchema }),
      ),
      topExpenseCategories: z.array(
        z.object({
          categoryId: z.string(),
          categoryName: z.string(),
          amount: z.number().finite(),
          previousAmount: z.number().finite(),
          share: z.number().finite(),
        }),
      ),
      monthlyBalanceHistory: z.array(
        z.object({ period: periodSchema, balance: z.number().finite() }),
      ),
    }),
  })
  .openapi("FinancialHealth");

export const AiDiagnosisResultOutputSchema = z
  .object({
    headline: z.string(),
    summary: z.string(),
    sections: z.array(
      z.object({
        title: z.string(),
        body: z.string(),
        tone: z.enum(aiDiagnosisSectionTones),
      }),
    ),
    charts: z.array(z.enum(aiDiagnosisChartKinds)),
    actions: z.array(
      z.object({
        kind: z.enum(aiDiagnosisActionKinds),
        label: z.string(),
        reason: z.string(),
        categoryId: z.uuid().nullable(),
      }),
    ),
  })
  .openapi("AiDiagnosisResult");

export const AiDiagnosisOutputSchema = z
  .object({
    id: z.uuid(),
    period: periodSchema,
    provider: z.enum(aiProviders),
    requestedModel: z.string().nullable(),
    sharedScopes: z.array(AiDataScopeSchema),
    /** Writing style of the whole text. */
    voice: z.enum(aiDiagnosisVoices),
    /** The model that actually answered, known once the diagnosis completes. */
    model: usedModelSchema.nullable(),
    status: z.enum(aiDiagnosisStatuses),
    failureCode: z.enum(aiDiagnosisFailureCodes).nullable(),
    health: FinancialHealthOutputSchema,
    result: AiDiagnosisResultOutputSchema.nullable(),
    createdAt: z.iso.datetime(),
    completedAt: z.iso.datetime().nullable(),
  })
  .openapi("AiDiagnosis");

export const AiDiagnosisSummaryOutputSchema = z
  .object({
    id: z.uuid(),
    period: periodSchema,
    provider: z.enum(aiProviders),
    model: usedModelSchema.nullable(),
    voice: z.enum(aiDiagnosisVoices),
    status: z.enum(aiDiagnosisStatuses),
    failureCode: z.enum(aiDiagnosisFailureCodes).nullable(),
    score: z.number().int().min(0).max(100),
    level: z.enum(financialHealthLevels),
    createdAt: z.iso.datetime(),
  })
  .openapi("AiDiagnosisSummary");

export const AiDiagnosesOutputSchema = z
  .object({ items: z.array(AiDiagnosisSummaryOutputSchema) })
  .openapi("AiDiagnoses");

export type CreateAiDiagnosisInput = z.infer<typeof CreateAiDiagnosisInputSchema>;
export type FinancialHealthOutput = z.infer<typeof FinancialHealthOutputSchema>;
export type AiDiagnosisResultOutput = z.infer<typeof AiDiagnosisResultOutputSchema>;
export type AiDiagnosisOutput = z.infer<typeof AiDiagnosisOutputSchema>;
export type AiDiagnosisSummaryOutput = z.infer<typeof AiDiagnosisSummaryOutputSchema>;
export type AiDiagnosesOutput = z.infer<typeof AiDiagnosesOutputSchema>;

function stripKeywords(value: unknown, keywords: string[]): unknown {
  if (Array.isArray(value)) return value.map((item) => stripKeywords(item, keywords));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !keywords.includes(key))
      .map(([key, item]) => [key, stripKeywords(item, keywords)]),
  );
}
