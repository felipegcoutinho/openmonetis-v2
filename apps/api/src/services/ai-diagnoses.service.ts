import type { AiDataScope } from "@openmonetis/domain/ai-data-sharing";
import {
  type AiDiagnosisFailureCode,
  type AiDiagnosisStatus,
  type AiDiagnosisVoice,
  aiDiagnosisDailyLimit,
  aiDiagnosisHistoryLimit,
  calculateFinancialHealth,
  completeFinancialHealthCharts,
  defaultAiDiagnosisVoice,
  type FinancialHealth,
  hasFinancialHealthData,
  isAiDiagnosisPendingExpired,
  selectAllowedAiDiagnosisActions,
} from "@openmonetis/domain/ai-diagnoses";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import {
  type AiDiagnosesOutput,
  AiDiagnosisModelOutputSchema,
  type AiDiagnosisOutput,
  type AiDiagnosisResultOutput,
  type CreateAiDiagnosisInput,
  createAiDiagnosisModelOutputJsonSchema,
} from "@openmonetis/validators/ai-diagnoses";
import { aiVoiceInstructions } from "../utils/ai-voices";
import { badRequest, conflict, notFound } from "../utils/errors";
import {
  type AiDataSharingReader,
  type AiFinancialContextReader,
  aiPeriodInstructions,
  type FinancialSnapshot,
} from "./ai-context.service";

const dailyWindowMs = 24 * 60 * 60_000;

export type AiDiagnosisUsedModel = { id: string; name: string };

export type AiDiagnosisRecord = {
  id: string;
  userId: string;
  period: string;
  provider: AiProvider;
  requestedModel: string | null;
  sharedScopes: AiDataScope[];
  voice: AiDiagnosisVoice;
  model: AiDiagnosisUsedModel | null;
  status: AiDiagnosisStatus;
  failureCode: AiDiagnosisFailureCode | null;
  health: FinancialHealth;
  result: AiDiagnosisResultOutput | null;
  createdAt: Date;
  completedAt: Date | null;
};

export type AiDiagnosesRepository = {
  insertPending(data: {
    userId: string;
    period: string;
    provider: AiProvider;
    requestedModel: string | null;
    sharedScopes: AiDataScope[];
    voice: AiDiagnosisVoice;
    health: FinancialHealth;
  }): Promise<AiDiagnosisRecord>;
  findByIdForUser(id: string, userId: string): Promise<AiDiagnosisRecord | null>;
  findPendingByUser(userId: string): Promise<AiDiagnosisRecord | null>;
  listRecentByUser(userId: string, limit: number): Promise<AiDiagnosisRecord[]>;
  countCreatedSince(userId: string, since: Date): Promise<number>;
  completePending(
    id: string,
    userId: string,
    result: AiDiagnosisResultOutput,
    model: AiDiagnosisUsedModel | null,
    completedAt: Date,
  ): Promise<AiDiagnosisRecord | null>;
  failPending(
    id: string,
    userId: string,
    failureCode: AiDiagnosisFailureCode,
    completedAt: Date,
  ): Promise<AiDiagnosisRecord | null>;
  deleteForUser(id: string, userId: string): Promise<boolean>;
};

export type AiDiagnosisProviderChecker = {
  /** Throws when the provider is not connected or the model is not in the account's catalog. */
  prepareRun(
    userId: string,
    provider: AiProvider,
    requestedModel?: string | null,
  ): Promise<{ model: string | null }>;
};

export type AiDiagnosisRunResult =
  | { status: "completed"; output: unknown; model: AiDiagnosisUsedModel | null }
  | {
      status: "failed";
      code: Extract<
        AiDiagnosisFailureCode,
        | "providerDisconnected"
        | "providerLimitReached"
        | "providerBusy"
        | "invalidOutput"
        | "runFailed"
        | "timedOut"
        | "canceled"
      >;
    };

export type AiDiagnosisRunner = {
  run(
    userId: string,
    provider: AiProvider,
    input: { instructions: string; prompt: string; schema: unknown; model: string | null },
  ): Promise<AiDiagnosisRunResult>;
  /** Stops the run in progress for this person and provider, if any. */
  cancel(userId: string, provider: AiProvider): Promise<void>;
};

function diagnosisInstructions(voice: AiDiagnosisVoice) {
  return [
    "You are the financial health assistant of OpenMonetis, a personal finance manager.",
    "Write an honest diagnosis of the user's finances in Brazilian Portuguese (pt-BR).",
    ...aiVoiceInstructions(voice),
    "The voice changes only the wording of the headline, summary, section bodies and action",
    "reasons. Numbers, the score and section tones are the same in every voice: a critical point",
    "stays critical and a positive one stays positive. Action labels are short, plain button texts.",
    "Examples only show the style; never reuse their values.",
    "Never mock, insult or judge the person, their income or their intelligence, never use",
    "profanity and never comment on other people named in the data.",
    "Use only the data provided. Every number you mention must come from it; never invent values,",
    "never recalculate indicators differently and never give investment, tax or legal advice.",
    "Indicators are percentages unless named in months or currency (BRL).",
    "Structure: a short headline, a summary paragraph, then 3 to 6 sections (for example spending,",
    "savings and reserve, upcoming bills and cards, categories that grew, next steps), each with a",
    "tone of positive, neutral, attention or critical.",
    "Pick the charts that best support the text, most relevant first.",
    "Suggest up to 5 concrete actions from the allowed kinds. Use categoryId only for",
    "reviewCategoryTransactions and createCategoryBudget, copying an id from the categories list;",
    "use null otherwise. Labels are short button texts in pt-BR; reasons explain the benefit.",
    "Category names may be placeholders such as 'Categoria 1'; write them exactly as given.",
    "Optional blocks (transactions, accounts, cards, budgets, goals) appear only when the user",
    "allowed them; when present, use them to be specific, citing their own values.",
    ...aiPeriodInstructions,
    "Answer only with the JSON object required by the schema.",
  ].join("\n");
}

export function createAiDiagnosesService(dependencies: {
  repository: AiDiagnosesRepository;
  context: AiFinancialContextReader;
  providers: AiDiagnosisProviderChecker;
  runner: AiDiagnosisRunner;
  dataSharing: AiDataSharingReader;
  schedule?: (task: () => Promise<void>) => void;
  now?: () => Date;
}) {
  const { repository, context, providers, runner, dataSharing } = dependencies;
  const now = dependencies.now ?? (() => new Date());
  const schedule =
    dependencies.schedule ??
    ((task: () => Promise<void>) => {
      setImmediate(() => {
        task().catch((error) => console.error("AI diagnosis failed", error));
      });
    });

  async function settleExpired(record: AiDiagnosisRecord) {
    if (record.status !== "pending" || !isAiDiagnosisPendingExpired(record.createdAt, now())) {
      return record;
    }
    return (await repository.failPending(record.id, record.userId, "interrupted", now())) ?? record;
  }

  async function findOwned(id: string, userId: string) {
    const record = await repository.findByIdForUser(id, userId);
    if (!record) throw notFound("Diagnosis not found", "ai_diagnosis_not_found");
    return settleExpired(record);
  }

  /** Best effort: the diagnosis is already settled, so a lost stop only wastes the run. */
  async function stopRun(record: AiDiagnosisRecord) {
    try {
      await runner.cancel(record.userId, record.provider);
    } catch (error) {
      console.error("AI service cancel failed", error);
    }
  }

  async function execute(record: AiDiagnosisRecord, loaded: FinancialSnapshot) {
    let described: Awaited<ReturnType<AiFinancialContextReader["describe"]>>;
    try {
      described = await context.describe({
        userId: record.userId,
        period: record.period,
        health: record.health,
        scopes: record.sharedScopes,
        loaded,
      });
    } catch (error) {
      console.error("AI diagnosis details failed", error);
      await repository.failPending(record.id, record.userId, "runFailed", now());
      return;
    }
    let outcome: AiDiagnosisRunResult;
    try {
      outcome = await runner.run(record.userId, record.provider, {
        instructions: diagnosisInstructions(record.voice),
        prompt: `Financial data (JSON):\n${JSON.stringify(described.data)}`,
        schema: createAiDiagnosisModelOutputJsonSchema(),
        model: record.requestedModel,
      });
    } catch (error) {
      console.error("AI service run failed", error);
      await repository.failPending(record.id, record.userId, "serviceUnavailable", now());
      return;
    }

    if (outcome.status === "failed") {
      await repository.failPending(record.id, record.userId, outcome.code, now());
      return;
    }

    const parsed = AiDiagnosisModelOutputSchema.safeParse(outcome.output);
    if (!parsed.success) {
      await repository.failPending(record.id, record.userId, "invalidOutput", now());
      return;
    }

    await repository.completePending(
      record.id,
      record.userId,
      {
        headline: described.aliases.restore(parsed.data.headline),
        summary: described.aliases.restore(parsed.data.summary),
        sections: parsed.data.sections.map((section) => ({
          ...section,
          title: described.aliases.restore(section.title),
          body: described.aliases.restore(section.body),
        })),
        charts: [...new Set(parsed.data.charts)],
        actions: selectAllowedAiDiagnosisActions(parsed.data.actions, described.categoryIds).map(
          (action) => ({
            ...action,
            label: described.aliases.restore(action.label),
            reason: described.aliases.restore(action.reason),
          }),
        ),
      },
      outcome.model,
      now(),
    );
  }

  return {
    async create(userId: string, input: CreateAiDiagnosisInput): Promise<AiDiagnosisOutput> {
      const sharedScopes = await dataSharing.scopesFor(userId);
      const { model: requestedModel } = await providers.prepareRun(
        userId,
        input.provider,
        input.model,
      );

      const pending = await repository.findPendingByUser(userId);
      if (pending && (await settleExpired(pending)).status === "pending") {
        throw conflict("A diagnosis is already in progress", "ai_diagnosis_in_progress");
      }

      const since = new Date(now().getTime() - dailyWindowMs);
      if ((await repository.countCreatedSince(userId, since)) >= aiDiagnosisDailyLimit) {
        throw conflict("Daily diagnosis limit reached", "ai_diagnosis_daily_limit");
      }

      const loaded = await context.load(userId, input.period);
      if (!hasFinancialHealthData(loaded.healthInput)) {
        throw badRequest("There is no financial data to diagnose", "ai_diagnosis_without_data");
      }

      const health = calculateFinancialHealth(loaded.healthInput);
      const record = await repository.insertPending({
        userId,
        period: input.period,
        provider: input.provider,
        requestedModel,
        sharedScopes,
        voice: input.voice ?? defaultAiDiagnosisVoice,
        health,
      });
      schedule(() => execute(record, loaded));
      return toAiDiagnosisOutput(record);
    },

    async get(id: string, userId: string): Promise<AiDiagnosisOutput> {
      return toAiDiagnosisOutput(await findOwned(id, userId));
    },

    async cancel(id: string, userId: string): Promise<AiDiagnosisOutput> {
      const record = await findOwned(id, userId);
      if (record.status !== "pending") {
        throw conflict("The diagnosis is no longer running", "ai_diagnosis_not_running");
      }
      // Settle first so a result arriving after the stop can no longer complete it.
      const canceled = await repository.failPending(id, userId, "canceled", now());
      if (canceled) await stopRun(canceled);
      return toAiDiagnosisOutput(canceled ?? (await findOwned(id, userId)));
    },

    async delete(id: string, userId: string): Promise<{ id: string }> {
      const record = await findOwned(id, userId);
      if (record.status === "pending") {
        await repository.failPending(id, userId, "canceled", now());
        await stopRun(record);
      }
      if (!(await repository.deleteForUser(id, userId))) {
        throw notFound("Diagnosis not found", "ai_diagnosis_not_found");
      }
      return { id };
    },

    async list(userId: string): Promise<AiDiagnosesOutput> {
      const records = await repository.listRecentByUser(userId, aiDiagnosisHistoryLimit);
      const settled = await Promise.all(records.map(settleExpired));
      return {
        items: settled.map((record) => ({
          id: record.id,
          period: record.period,
          provider: record.provider,
          model: record.model,
          voice: record.voice,
          status: record.status,
          failureCode: record.failureCode,
          score: record.health.score,
          level: record.health.level,
          createdAt: record.createdAt.toISOString(),
        })),
      };
    },
  };
}

export type AiDiagnosesService = ReturnType<typeof createAiDiagnosesService>;

function toAiDiagnosisOutput(record: AiDiagnosisRecord): AiDiagnosisOutput {
  return {
    id: record.id,
    period: record.period,
    provider: record.provider,
    requestedModel: record.requestedModel,
    sharedScopes: record.sharedScopes,
    voice: record.voice,
    model: record.model,
    status: record.status,
    failureCode: record.failureCode,
    health: completeFinancialHealthCharts(record.health),
    result: record.result,
    createdAt: record.createdAt.toISOString(),
    completedAt: record.completedAt?.toISOString() ?? null,
  };
}
