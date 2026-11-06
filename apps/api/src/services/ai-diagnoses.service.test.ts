import assert from "node:assert/strict";
import test from "node:test";
import type { AiDataScope } from "@openmonetis/domain/ai-data-sharing";
import type {
  DashboardAttentionOutput,
  DashboardSnapshotOutput,
} from "@openmonetis/validators/dashboard";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { ApiError } from "../utils/errors";
import { createAiContextService } from "./ai-context.service";
import {
  type AiDiagnosesRepository,
  type AiDiagnosisRecord,
  type AiDiagnosisRunResult,
  createAiDiagnosesService,
} from "./ai-diagnoses.service";

const userId = "00000000-0000-4000-8000-000000000001";
const categoryId = "00000000-0000-4000-8000-0000000000c1";
const now = new Date("2026-06-15T12:00:00.000Z");

function snapshot(): DashboardSnapshotOutput {
  const history = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"].map(
    (period) => ({ period, income: 10_000, expenses: 7_000, balance: 3_000 }),
  );
  const pair = (current: number) => ({ current, previous: current, hasPreviousData: true });
  return {
    metrics: {
      period: "2026-06",
      previousPeriod: "2026-05",
      income: pair(10_000),
      expenses: pair(7_000),
      balance: pair(3_000),
      projected: pair(45_000),
      history,
    },
    accounts: {
      period: "2026-06",
      scope: { accountingBasis: "cash", includePending: false, personScope: "primary" },
      totalBalance: 42_000,
      items: [],
    },
    paymentStatus: {
      period: "2026-06",
      income: { total: 10_000, confirmed: 10_000, pending: 0 },
      expenses: { total: 7_000, confirmed: 6_000, pending: 1_000 },
    },
    expenseDistribution: {
      period: "2026-06",
      totalAmount: 7_000,
      transactionCount: 12,
      conditions: [],
      paymentMethods: [],
    },
    categoryBreakdown: {
      period: "2026-06",
      previousPeriod: "2026-05",
      incomeTotal: 10_000,
      expensesTotal: 7_000,
      income: [],
      expenses: [
        {
          categoryId,
          categoryName: "Moradia",
          categoryIcon: null,
          amount: 7_000,
          previousAmount: 6_500,
          count: 3,
          percentage: 100,
        },
      ],
    },
    peopleExpenses: {
      period: "2026-06",
      previousPeriod: "2026-05",
      totalAmount: 7_000,
      items: [
        {
          personId: userId,
          personName: "Pessoa Privada",
          personAvatarUrl: null,
          personRole: "admin",
          personStatus: "active",
          amount: 7_000,
          previousAmount: 6_500,
          count: 12,
          percentage: 100,
        },
      ],
    },
  };
}

const attention: DashboardAttentionOutput = {
  period: "2026-06",
  items: [],
  unavailableSources: [],
};

function createRepository(initial: AiDiagnosisRecord[] = []) {
  const records = [...initial];
  const update = (id: string, changes: Partial<AiDiagnosisRecord>) => {
    const record = records.find((item) => item.id === id && item.status === "pending");
    if (!record) return null;
    Object.assign(record, changes);
    return record;
  };
  const repository: AiDiagnosesRepository = {
    async insertPending(data) {
      const record: AiDiagnosisRecord = {
        ...data,
        id: `00000000-0000-4000-8000-${String(records.length + 1).padStart(12, "0")}`,
        model: null,
        status: "pending",
        failureCode: null,
        result: null,
        createdAt: now,
        completedAt: null,
      };
      records.push(record);
      return record;
    },
    async findByIdForUser(id, owner) {
      return records.find((record) => record.id === id && record.userId === owner) ?? null;
    },
    async findPendingByUser(owner) {
      return (
        records.find((record) => record.userId === owner && record.status === "pending") ?? null
      );
    },
    async listRecentByUser(owner, limit) {
      return records.filter((record) => record.userId === owner).slice(0, limit);
    },
    async countCreatedSince(owner, since) {
      return records.filter((record) => record.userId === owner && record.createdAt >= since)
        .length;
    },
    async completePending(id, _owner, result, model, completedAt) {
      return update(id, { status: "completed", result, model, completedAt });
    },
    async failPending(id, _owner, failureCode, completedAt) {
      return update(id, { status: "failed", failureCode, completedAt });
    },
    async deleteForUser(id, owner) {
      const index = records.findIndex((record) => record.id === id && record.userId === owner);
      if (index < 0) return false;
      records.splice(index, 1);
      return true;
    },
  };
  return { records, repository };
}

function createService(options: {
  repository: AiDiagnosesRepository;
  ready?: boolean;
  run?: (
    prompt: string,
    model: string | null,
    instructions: string,
  ) => Promise<AiDiagnosisRunResult>;
  preferredModel?: string | null;
  onCancel?: () => void;
  scopes?: AiDataScope[];
}) {
  const tasks: Array<() => Promise<void>> = [];
  const service = createAiDiagnosesService({
    repository: options.repository,
    context: createAiContextService({
      snapshots: { getSnapshot: async () => snapshot(), getAttention: async () => attention },
      details: {
        listTransactions: async () => [privateTransaction],
        listAccounts: async () => [],
        listCards: async () => [],
        listBudgets: async () => [],
        listGoals: async () => [],
      },
    }),
    providers: {
      prepareRun: async (_owner, _provider, requested) => {
        if (options.ready === false) {
          throw new ApiError("Not connected", "ai_provider_not_connected", 409);
        }
        return { model: requested ?? options.preferredModel ?? null };
      },
    },
    runner: {
      run: async (_owner, _provider, input) =>
        options.run
          ? options.run(input.prompt, input.model, input.instructions)
          : { status: "failed", code: "runFailed" },
      cancel: async () => options.onCancel?.(),
    },
    dataSharing: { scopesFor: async () => options.scopes ?? [] },
    schedule: (task) => tasks.push(task),
    now: () => now,
  });
  return { service, runScheduled: () => Promise.all(tasks.map((task) => task())) };
}

const sonnet = { id: "claude-sonnet-5-5", name: "Sonnet 5.5" };

const privateTransaction = {
  purchaseDate: "2026-06-05",
  name: "Aluguel do apartamento",
  type: "expense",
  amount: -2_500,
  condition: "single",
  paymentMethod: "pix",
  categoryId,
  categoryName: "Moradia",
  isSettled: true,
  dueDate: null,
  currentInstallment: null,
  installmentCount: null,
  recurrenceFrequency: null,
  accountName: "Conta Privada",
  cardName: null,
  personName: "Pessoa Privada",
  splitShares: [],
  note: "Anotação privada",
} as unknown as TransactionOutput;

const validOutput = {
  headline: "Finanças saudáveis",
  summary: "Você poupa 30% da renda.",
  sections: [{ title: "Reserva", body: "Seis meses de reserva.", tone: "positive" }],
  charts: ["incomeExpenseHistory", "incomeExpenseHistory"],
  actions: [
    { kind: "createCategoryBudget", label: "Orçar moradia", reason: "Controle", categoryId },
    { kind: "reviewCategoryTransactions", label: "Ver", reason: "Ver", categoryId: "inventado" },
  ],
};

test("a diagnosis stores the calculated health and completes with sanitized model output", async () => {
  const { records, repository } = createRepository();
  let sentPrompt = "";
  const { service, runScheduled } = createService({
    repository,
    run: async (prompt) => {
      sentPrompt = prompt;
      return { status: "completed", output: validOutput, model: sonnet };
    },
  });

  const created = await service.create(userId, { period: "2026-06", provider: "claude" });
  assert.equal(created.status, "pending");
  assert.equal(created.health.score, 100);

  await runScheduled();
  const completed = await service.get(created.id, userId);

  assert.equal(completed.status, "completed");
  assert.deepEqual(completed.model, sonnet);
  assert.deepEqual(completed.result?.charts, ["incomeExpenseHistory"]);
  assert.deepEqual(
    completed.result?.actions.map((action) => [action.kind, action.categoryId]),
    [["createCategoryBudget", categoryId]],
  );
  assert.equal(records.length, 1);
  // By default category names stay in OpenMonetis and no transaction leaves it.
  assert.doesNotMatch(sentPrompt, /Moradia/);
  assert.match(sentPrompt, /Categoria 1/);
  assert.doesNotMatch(sentPrompt, /Aluguel do apartamento|Pessoa Privada/);
  assert.deepEqual(completed.sharedScopes, []);
  assert.doesNotMatch(sentPrompt, new RegExp(userId));
});

test("model output outside the contract fails the diagnosis", async () => {
  const { repository } = createRepository();
  const { service, runScheduled } = createService({
    repository,
    run: async () => ({ status: "completed", output: { headline: "" }, model: null }),
  });

  const created = await service.create(userId, { period: "2026-06", provider: "codex" });
  await runScheduled();

  const failed = await service.get(created.id, userId);
  assert.equal(failed.status, "failed");
  assert.equal(failed.failureCode, "invalidOutput");
  assert.equal(failed.result, null);
});

test("provider failures are kept as the diagnosis failure code", async () => {
  const { repository } = createRepository();
  const { service, runScheduled } = createService({
    repository,
    run: async () => ({ status: "failed", code: "providerLimitReached" }),
  });

  const created = await service.create(userId, { period: "2026-06", provider: "claude" });
  await runScheduled();

  assert.equal((await service.get(created.id, userId)).failureCode, "providerLimitReached");
});

test("a diagnosis needs a connected provider and only one may run at a time", async () => {
  const { repository } = createRepository();
  const disconnected = createService({ repository, ready: false }).service;
  await assert.rejects(
    disconnected.create(userId, { period: "2026-06", provider: "claude" }),
    (error) => error instanceof ApiError && error.code === "ai_provider_not_connected",
  );

  const { service } = createService({ repository });
  await service.create(userId, { period: "2026-06", provider: "claude" });
  await assert.rejects(
    service.create(userId, { period: "2026-06", provider: "claude" }),
    (error) => error instanceof ApiError && error.code === "ai_diagnosis_in_progress",
  );
});

test("a pending diagnosis lost by a restart is reported as interrupted", async () => {
  const { repository } = createRepository([
    {
      id: "00000000-0000-4000-8000-00000000000a",
      userId,
      period: "2026-06",
      provider: "claude",
      requestedModel: null,
      sharedScopes: [],
      voice: "balanced",
      model: null,
      status: "pending",
      failureCode: null,
      health: {
        score: 50,
        level: "fair",
        indicators: {
          savingsRate: null,
          averageSavingsRate: null,
          averageMonthlyExpenses: null,
          emergencyFundMonths: null,
          expenseTrend: null,
          topCategoryShare: null,
          criticalAttentionItems: 0,
          warningAttentionItems: 0,
        },
        charts: {
          incomeExpenseHistory: [],
          savingsRateHistory: [],
          topExpenseCategories: [],
          monthlyBalanceHistory: [],
        },
      },
      result: null,
      createdAt: new Date(now.getTime() - 10 * 60_000),
      completedAt: null,
    },
  ]);
  const { service } = createService({ repository });

  const diagnosis = await service.get("00000000-0000-4000-8000-00000000000a", userId);
  assert.equal(diagnosis.status, "failed");
  assert.equal(diagnosis.failureCode, "interrupted");
});

test("the resolved model is requested from the provider and kept with the diagnosis", async () => {
  const { repository } = createRepository();
  let usedModel: string | null = "unset";
  const { service, runScheduled } = createService({
    repository,
    preferredModel: "opus",
    run: async (_prompt, model) => {
      usedModel = model;
      return { status: "completed", output: validOutput, model: null };
    },
  });

  const preferred = await service.create(userId, { period: "2026-06", provider: "claude" });
  await runScheduled();
  assert.equal(preferred.requestedModel, "opus");
  assert.equal(usedModel, "opus");
  assert.equal((await service.list(userId)).items[0]?.model, null);
});

test("the requested voice shapes the instructions and defaults to balanced", async () => {
  const { repository } = createRepository();
  const sent: string[] = [];
  const { service, runScheduled } = createService({
    repository,
    run: async (_prompt, _model, instructions) => {
      sent.push(instructions);
      return { status: "completed", output: validOutput, model: null };
    },
  });

  const balanced = await service.create(userId, { period: "2026-06", provider: "claude" });
  await runScheduled();
  const stern = await service.create(userId, {
    period: "2026-06",
    provider: "claude",
    voice: "stern",
  });
  await runScheduled();

  assert.equal(balanced.voice, "balanced");
  assert.equal(stern.voice, "stern");
  assert.match(sent[0] ?? "", /warm and honest/);
  assert.match(sent.at(-1) ?? "", /firm, serious reprimand/);
  // Every voice covers the whole text, critical points included.
  assert.match(sent[0] ?? "", /Keep the voice in the whole text/);
  assert.match(sent.at(-1) ?? "", /Keep the voice in the whole text/);
  // Every voice keeps the rules that protect numbers, tones and the person.
  for (const instructions of sent) {
    assert.match(instructions, /a critical point\s+stays critical/);
    assert.match(instructions, /Never mock, insult or judge the person/);
  }
  assert.equal((await service.list(userId)).items[0]?.voice, "balanced");
});

test("stopping a running diagnosis settles it as canceled and stops the CLI", async () => {
  const { records, repository } = createRepository();
  let stops = 0;
  const { service, runScheduled } = createService({
    repository,
    onCancel: () => {
      stops += 1;
    },
    run: async () => ({ status: "completed", output: validOutput, model: sonnet }),
  });

  const created = await service.create(userId, { period: "2026-06", provider: "claude" });
  const canceled = await service.cancel(created.id, userId);
  assert.equal(canceled.status, "failed");
  assert.equal(canceled.failureCode, "canceled");
  assert.equal(stops, 1);

  // A result that arrives after the stop is discarded.
  await runScheduled();
  assert.equal(records[0]?.status, "failed");
  assert.equal(records[0]?.result, null);

  await assert.rejects(
    service.cancel(created.id, userId),
    (error) => error instanceof ApiError && error.code === "ai_diagnosis_not_running",
  );
  await assert.rejects(
    service.cancel(created.id, "00000000-0000-4000-8000-000000000999"),
    (error) => error instanceof ApiError && error.code === "ai_diagnosis_not_found",
  );
});

test("deleting a diagnosis removes it from the history, stopping it when still running", async () => {
  const { records, repository } = createRepository();
  let stops = 0;
  const { service } = createService({
    repository,
    onCancel: () => {
      stops += 1;
    },
  });

  const created = await service.create(userId, { period: "2026-06", provider: "claude" });
  await assert.rejects(
    service.delete(created.id, "00000000-0000-4000-8000-000000000999"),
    (error) => error instanceof ApiError && error.code === "ai_diagnosis_not_found",
  );
  assert.deepEqual(await service.delete(created.id, userId), { id: created.id });
  assert.equal(stops, 1);
  assert.equal(records.length, 0);
});

test("placeholders written by the provider come back as the real category names", async () => {
  const { repository } = createRepository();
  const { service, runScheduled } = createService({
    repository,
    run: async () => ({
      status: "completed",
      output: {
        ...validOutput,
        headline: "Categoria 1 pesa no mês",
        actions: [{ ...validOutput.actions[0], label: "Orçar Categoria 1" }],
      },
      model: null,
    }),
  });

  const created = await service.create(userId, { period: "2026-06", provider: "claude" });
  await runScheduled();
  const completed = await service.get(created.id, userId);
  assert.equal(completed.result?.headline, "Moradia pesa no mês");
  assert.equal(completed.result?.actions[0]?.label, "Orçar Moradia");
});

test("full permission sends transactions with people, notes, accounts and real names", async () => {
  const { repository } = createRepository();
  let sentPrompt = "";
  const { service, runScheduled } = createService({
    repository,
    scopes: ["categoryNames", "transactions", "people", "notes", "accounts", "budgetsAndGoals"],
    run: async (prompt) => {
      sentPrompt = prompt;
      return { status: "completed", output: validOutput, model: null };
    },
  });

  const created = await service.create(userId, { period: "2026-06", provider: "claude" });
  await runScheduled();
  for (const value of ["Moradia", "Aluguel do apartamento", "Pessoa Privada", "Anotação privada"]) {
    assert.match(sentPrompt, new RegExp(value));
  }
  assert.match(sentPrompt, /Conta Privada/);
  assert.doesNotMatch(sentPrompt, new RegExp(userId));
  assert.equal(created.sharedScopes.length, 6);
});

test("transactions without people or notes keep those fields out", async () => {
  const { repository } = createRepository();
  let sentPrompt = "";
  const { service, runScheduled } = createService({
    repository,
    scopes: ["transactions"],
    run: async (prompt) => {
      sentPrompt = prompt;
      return { status: "completed", output: validOutput, model: null };
    },
  });

  await service.create(userId, { period: "2026-06", provider: "claude" });
  await runScheduled();
  assert.match(sentPrompt, /Aluguel do apartamento/);
  assert.doesNotMatch(sentPrompt, /Pessoa Privada|Anotação privada|Conta Privada|Moradia/);
});
