import assert from "node:assert/strict";
import test from "node:test";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { ApiError } from "../utils/errors";
import {
  type AiProviderConnectionRecord,
  type AiProvidersGateway,
  type AiProvidersRepository,
  createAiProvidersService,
} from "./ai-providers.service";

const userId = "00000000-0000-4000-8000-000000000001";
const consentedAt = new Date("2026-06-15T12:00:00.000Z");
const catalog = [
  { id: "gpt-a", name: "GPT A", isDefault: true },
  { id: "gpt-b", name: "GPT B", isDefault: false },
];

function connection(
  provider: AiProvider,
  preferredModel: string | null = null,
): AiProviderConnectionRecord {
  return { provider, consentedAt, preferredModel };
}

function createRepository(initial: AiProviderConnectionRecord[] = []) {
  const records = [...initial];
  const repository: AiProvidersRepository = {
    listByUser: async () => records,
    async saveConsent(_owner, provider, at) {
      const existing = records.find((record) => record.provider === provider);
      if (existing) existing.consentedAt = at;
      else records.push({ provider, consentedAt: at, preferredModel: null });
    },
    async savePreferredModel(_owner, provider, preferredModel) {
      const existing = records.find((record) => record.provider === provider);
      if (existing) existing.preferredModel = preferredModel;
      return Boolean(existing);
    },
    async deleteForUser(_owner, provider) {
      const index = records.findIndex((record) => record.provider === provider);
      if (index >= 0) records.splice(index, 1);
    },
  };
  return { records, repository };
}

function createGateway(overrides: Partial<AiProvidersGateway> = {}): AiProvidersGateway {
  return {
    enabled: true,
    readAccount: async () => ({ email: "pessoa@example.com" }),
    listModels: async () => catalog,
    disconnect: async () => undefined,
    startLogin: async (_owner, provider: AiProvider) => ({
      loginId: "00000000-0000-4000-8000-0000000000aa",
      provider,
      method: "deviceCode",
      status: "pending",
      verificationUrl: "https://auth.openai.com/codex/device",
      userCode: "ABCD-1234",
      expiresAt: consentedAt.toISOString(),
    }),
    getLogin: async () => null,
    submitLoginCode: async () => null,
    ...overrides,
  };
}

const rejectsWith = (code: string) => (error: unknown) =>
  error instanceof ApiError && error.code === code;

test("a disabled installation lists every provider as disconnected without calling the service", async () => {
  const { repository } = createRepository([connection("claude")]);
  const service = createAiProvidersService(
    repository,
    createGateway({
      enabled: false,
      readAccount: async () => assert.fail("must not be called"),
    }),
  );

  const result = await service.list(userId);
  assert.equal(result.enabled, false);
  assert.deepEqual(
    result.items.map((item) => item.status),
    ["disconnected", "disconnected", "disconnected"],
  );
  await assert.rejects(
    service.startLogin(userId, "claude", { acceptDataSharing: true }),
    rejectsWith("ai_disabled"),
  );
});

test("starting a sign-in records consent; connected providers list their models", async () => {
  const { records, repository } = createRepository();
  const service = createAiProvidersService(
    repository,
    createGateway({
      readAccount: async (_owner, provider) =>
        provider === "codex" ? { email: "pessoa@example.com" } : null,
    }),
    { now: () => consentedAt },
  );

  const login = await service.startLogin(userId, "codex", { acceptDataSharing: true });
  assert.equal(login.userCode, "ABCD-1234");
  assert.deepEqual(records, [connection("codex")]);

  const result = await service.list(userId);
  assert.deepEqual(result.items, [
    {
      provider: "claude",
      status: "disconnected",
      consentedAt: null,
      preferredModel: null,
      models: [],
      accountEmail: null,
    },
    {
      provider: "codex",
      status: "connected",
      consentedAt: consentedAt.toISOString(),
      preferredModel: null,
      models: catalog,
      accountEmail: "pessoa@example.com",
    },
    {
      provider: "antigravity",
      status: "disconnected",
      consentedAt: null,
      preferredModel: null,
      models: [],
      accountEmail: null,
    },
  ]);
});

test("an unreachable AI service is reported as unavailable, not as signed out", async () => {
  const { repository } = createRepository([connection("claude")]);
  const service = createAiProvidersService(
    repository,
    createGateway({
      readAccount: async () => {
        throw new Error("offline");
      },
    }),
  );

  assert.equal((await service.list(userId)).items[0]?.status, "unavailable");
});

test("the preferred model must come from the account's catalog", async () => {
  const { records, repository } = createRepository([connection("codex")]);
  const service = createAiProvidersService(repository, createGateway());

  await assert.rejects(
    service.update(userId, "codex", { preferredModel: "gpt-unknown" }),
    rejectsWith("ai_model_unavailable"),
  );
  const updated = await service.update(userId, "codex", { preferredModel: "gpt-b" });
  assert.equal(updated.preferredModel, "gpt-b");
  assert.equal(records[0]?.preferredModel, "gpt-b");
  await assert.rejects(
    service.update(userId, "claude", { preferredModel: null }),
    rejectsWith("ai_provider_not_connected"),
  );
});

test("a run uses the requested model, then the preferred one, then the plan default", async () => {
  const { repository } = createRepository([connection("codex", "gpt-b")]);
  const service = createAiProvidersService(repository, createGateway());

  assert.deepEqual(await service.prepareRun(userId, "codex", "gpt-a"), { model: "gpt-a" });
  assert.deepEqual(await service.prepareRun(userId, "codex"), { model: "gpt-b" });
  await assert.rejects(
    service.prepareRun(userId, "codex", "gpt-unknown"),
    rejectsWith("ai_model_unavailable"),
  );

  const lost = createAiProvidersService(
    createRepository([connection("codex", "gpt-retired")]).repository,
    createGateway(),
  );
  assert.deepEqual(await lost.prepareRun(userId, "codex"), { model: null });
});

test("disconnecting removes the sign-in and the consent", async () => {
  const { records, repository } = createRepository([connection("claude")]);
  let disconnected: AiProvider | null = null;
  const service = createAiProvidersService(
    repository,
    createGateway({
      disconnect: async (_owner, provider) => {
        disconnected = provider;
      },
    }),
  );

  await service.disconnect(userId, "claude");
  assert.equal(disconnected, "claude");
  assert.deepEqual(records, []);
  await assert.rejects(
    service.prepareRun(userId, "claude"),
    rejectsWith("ai_provider_not_connected"),
  );
});
