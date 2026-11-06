import assert from "node:assert/strict";
import test from "node:test";
import type { AiToolJobOutput, AiToolOutput } from "@openmonetis/validators/ai-tools";
import { ApiError } from "../utils/errors";
import {
  type AiToolEventRecord,
  type AiToolsGateway,
  type AiToolsRepository,
  createAiToolsService,
} from "./ai-tools.service";

const adminId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";
const jobId = "33333333-3333-4333-8333-333333333333";
const now = new Date("2026-11-10T12:00:00.000Z");

const claude: AiToolOutput = {
  provider: "claude",
  bundledVersion: "2.1.316",
  activeVersion: null,
  previousVersion: null,
  latest: {
    version: "2.1.320",
    releasedAt: "2026-11-01T00:00:00.000Z",
    eligibleAt: "2026-11-04T00:00:00.000Z",
    blocker: null,
  },
  job: null,
};

function job(overrides: Partial<AiToolJobOutput> = {}): AiToolJobOutput {
  return {
    jobId,
    provider: "claude",
    version: "2.1.320",
    status: "pending",
    step: "download",
    failureCode: null,
    startedAt: now.toISOString(),
    ...overrides,
  };
}

function setup(gatewayOverrides: Partial<AiToolsGateway> = {}) {
  const events: Array<AiToolEventRecord & { userId: string; completedAt: Date | null }> = [];
  const calls: unknown[][] = [];
  const repository: AiToolsRepository = {
    findInstallationAdminId: async () => adminId,
    async insertEvent(userId, event, completedAt) {
      events.push({ ...event, userId, completedAt, id: crypto.randomUUID(), createdAt: now });
    },
    async completeEvent(id, status, failureCode, completedAt) {
      for (const event of events) {
        if (event.jobId === id)
          Object.assign(event, { status, failureCode, completedAt, jobId: null });
      }
    },
    listEvents: async () => events,
    listPendingJobIds: async () =>
      events.flatMap((event) => (event.status === "pending" && event.jobId ? [event.jobId] : [])),
  };
  const gateway: AiToolsGateway = {
    enabled: true,
    listTools: async () => [claude],
    async installTool(...args) {
      calls.push(["install", ...args]);
      return job();
    },
    getToolJob: async () => job({ status: "completed", step: "activate" }),
    async activateTool(...args) {
      calls.push(["activate", ...args]);
      return { tool: { ...claude, activeVersion: null, previousVersion: "2.1.320" } };
    },
    ...gatewayOverrides,
  };
  return { service: createAiToolsService(repository, gateway, { now: () => now }), events, calls };
}

test("only the first account sees and changes the CLI builds", async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.list(otherId), { allowed: false, items: [] });
  await assert.rejects(
    service.listEvents(otherId),
    (error: unknown) => error instanceof ApiError && error.status === 403,
  );
  await assert.rejects(
    service.install(otherId, "claude", { version: "2.1.320", canary: false }),
    (error: unknown) => error instanceof ApiError && error.status === 403,
  );
  await assert.rejects(
    service.activate(otherId, "claude", { version: null }),
    (error: unknown) => error instanceof ApiError && error.code === "ai_tools_forbidden",
  );
  assert.deepEqual(calls, []);
  assert.equal((await service.list(adminId)).allowed, true);
});

test("an install is recorded and settled when its job finishes", async () => {
  const { service, events, calls } = setup();
  await service.install(adminId, "claude", { version: "2.1.320", canary: true });
  assert.deepEqual(calls, [["install", "claude", "2.1.320", adminId]]);
  assert.equal(events[0]?.status, "pending");
  assert.equal(events[0]?.fromVersion, "2.1.316");
  assert.equal(events[0]?.jobId, jobId);

  const finished = await service.getJob(adminId, "claude", jobId);
  assert.equal(finished.status, "completed");
  assert.equal(events[0]?.status, "completed");
  assert.equal(events[0]?.jobId, null);
  assert.deepEqual(events[0]?.completedAt, now);
});

test("a refused install is recorded as failed without a job to follow", async () => {
  const { service, events } = setup({
    installTool: async () => job({ status: "failed", failureCode: "tooRecent" }),
  });
  const result = await service.install(adminId, "claude", { version: "2.1.320", canary: false });
  assert.equal(result.failureCode, "tooRecent");
  assert.equal(events[0]?.status, "failed");
  assert.equal(events[0]?.jobId, null);
});

test("going back to the image is recorded, and a refused switch is a conflict", async () => {
  const { service, events } = setup();
  await service.activate(adminId, "claude", { version: null });
  assert.equal(events[0]?.action, "restoreBundled");
  assert.equal(events[0]?.toVersion, "2.1.316");

  const refused = setup({ activateTool: async () => ({ failureCode: "unknownVersion" }) });
  await assert.rejects(
    refused.service.activate(adminId, "claude", { version: "2.1.300" }),
    (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.code === "ai_tool_unknown_version",
  );
  assert.equal(refused.events[0]?.status, "failed");
});

test("an install lost in an AI service restart is recorded as failed", async () => {
  const { service, events } = setup({ getToolJob: async () => null });
  await service.install(adminId, "claude", { version: "2.1.320", canary: false });
  assert.equal(events[0]?.status, "pending");

  // The restarted service lists no job for it.
  await service.list(adminId);
  const listed = await service.listEvents(adminId);
  assert.equal(listed.items[0]?.status, "failed");
  assert.equal(listed.items[0]?.failureCode, "installFailed");
  assert.equal(events[0]?.jobId, null);
});

test("a finished install is settled before the next one replaces it", async () => {
  let current: AiToolJobOutput | null = null;
  const { service, events } = setup({
    listTools: async () => [{ ...claude, job: current }],
    async installTool() {
      current = job({ jobId: crypto.randomUUID() });
      return current;
    },
  });
  await service.install(adminId, "claude", { version: "2.1.320", canary: false });
  current = { ...(current as unknown as AiToolJobOutput), status: "completed", step: "activate" };
  await service.install(adminId, "claude", { version: "2.1.321", canary: false });
  await service.list(adminId);
  assert.equal(events[0]?.status, "completed");
  assert.equal(events[1]?.status, "pending");
});
