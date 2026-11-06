import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type {
  AiToolEventAction,
  AiToolEventStatus,
  AiToolFailureCode,
} from "@openmonetis/domain/ai-tools";
import type {
  ActivateAiToolInput,
  AiToolEventOutput,
  AiToolEventsOutput,
  AiToolJobOutput,
  AiToolOutput,
  AiToolsOutput,
  InstallAiToolInput,
} from "@openmonetis/validators/ai-tools";
import { conflict, forbidden, notFound, serviceUnavailable } from "../utils/errors";

/** The AI service, which keeps the CLI builds; `canaryUserId` names whose sign-in tests one. */
export type AiToolsGateway = {
  enabled: boolean;
  listTools(): Promise<AiToolOutput[]>;
  installTool(
    provider: AiProvider,
    version: string,
    canaryUserId: string | null,
  ): Promise<AiToolJobOutput>;
  getToolJob(provider: AiProvider, jobId: string): Promise<AiToolJobOutput | null>;
  activateTool(
    provider: AiProvider,
    version: string | null,
  ): Promise<{ tool: AiToolOutput } | { failureCode: AiToolFailureCode }>;
};

export type AiToolEventRecord = {
  id: string;
  provider: AiProvider;
  action: AiToolEventAction;
  fromVersion: string | null;
  toVersion: string | null;
  status: AiToolEventStatus;
  failureCode: AiToolFailureCode | null;
  jobId: string | null;
  createdAt: Date;
};

export type AiToolsRepository = {
  /** The first account created in this installation, which administers it. */
  findInstallationAdminId(): Promise<string | null>;
  insertEvent(
    userId: string,
    event: Omit<AiToolEventRecord, "id" | "createdAt">,
    completedAt: Date | null,
  ): Promise<void>;
  completeEvent(
    jobId: string,
    status: Exclude<AiToolEventStatus, "pending">,
    failureCode: AiToolFailureCode | null,
    completedAt: Date,
  ): Promise<void>;
  /** Newest first; admin changes are rare, so the whole history is small enough to list. */
  listEvents(): Promise<AiToolEventRecord[]>;
  listPendingJobIds(): Promise<string[]>;
};

export function createAiToolsService(
  repository: AiToolsRepository,
  gateway: AiToolsGateway,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());

  async function isAdmin(userId: string) {
    return (await repository.findInstallationAdminId()) === userId;
  }

  async function requireAdmin(userId: string) {
    if (!(await isAdmin(userId))) {
      throw forbidden("Only the installation admin manages AI tools", "ai_tools_forbidden");
    }
    if (!gateway.enabled) throw serviceUnavailable("AI features are not enabled", "ai_disabled");
  }

  async function reach<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      console.error("AI service tools request failed", error);
      throw serviceUnavailable("AI service unavailable", "ai_service_unavailable");
    }
  }

  async function toolOf(provider: AiProvider) {
    const tool = (await reach(() => gateway.listTools())).find(
      (item) => item.provider === provider,
    );
    if (!tool) throw notFound("AI tool not found", "ai_tool_not_found");
    return tool;
  }

  /** Records the result of an install the AI service has finished. */
  async function settle(job: AiToolJobOutput) {
    if (job.status === "pending") return;
    await repository.completeEvent(job.jobId, job.status, job.failureCode, now());
  }

  function toEventOutput(event: AiToolEventRecord): AiToolEventOutput {
    return {
      id: event.id,
      provider: event.provider,
      action: event.action,
      fromVersion: event.fromVersion,
      toVersion: event.toVersion,
      status: event.status,
      failureCode: event.failureCode,
      createdAt: event.createdAt.toISOString(),
    };
  }

  return {
    async list(userId: string): Promise<AiToolsOutput> {
      if (!(await isAdmin(userId)) || !gateway.enabled) return { allowed: false, items: [] };
      const items = await reach(() => gateway.listTools());
      for (const item of items) if (item.job) await settle(item.job);
      // An install the AI service no longer knows about was cut short by a restart.
      const known = new Set(items.flatMap((item) => (item.job ? [item.job.jobId] : [])));
      for (const jobId of await repository.listPendingJobIds()) {
        if (!known.has(jobId))
          await repository.completeEvent(jobId, "failed", "installFailed", now());
      }
      return { allowed: true, items };
    },

    async listEvents(userId: string): Promise<AiToolEventsOutput> {
      await requireAdmin(userId);
      return { items: (await repository.listEvents()).map(toEventOutput) };
    },

    async install(userId: string, provider: AiProvider, input: InstallAiToolInput) {
      await requireAdmin(userId);
      const tool = await toolOf(provider);
      // The AI service keeps only the latest job per provider, so the previous one is settled now.
      if (tool.job) await settle(tool.job);
      const job = await reach(() =>
        gateway.installTool(provider, input.version, input.canary ? userId : null),
      );
      const settled = job.status === "pending" ? null : now();
      await repository.insertEvent(
        userId,
        {
          provider,
          action: "install",
          fromVersion: tool.activeVersion ?? tool.bundledVersion,
          toVersion: input.version,
          status: job.status,
          failureCode: job.failureCode,
          // A refused install never ran, so there is no job to follow.
          jobId: settled ? null : job.jobId,
        },
        settled,
      );
      return job;
    },

    async getJob(userId: string, provider: AiProvider, jobId: string) {
      await requireAdmin(userId);
      const job = await reach(() => gateway.getToolJob(provider, jobId));
      if (!job) {
        await repository.completeEvent(jobId, "failed", "installFailed", now());
        throw notFound("AI tool install not found", "ai_tool_job_not_found");
      }
      await settle(job);
      return job;
    },

    async activate(userId: string, provider: AiProvider, input: ActivateAiToolInput) {
      await requireAdmin(userId);
      const tool = await toolOf(provider);
      const result = await reach(() => gateway.activateTool(provider, input.version));
      const failureCode = "failureCode" in result ? result.failureCode : null;
      await repository.insertEvent(
        userId,
        {
          provider,
          action: input.version === null ? "restoreBundled" : "activate",
          fromVersion: tool.activeVersion ?? tool.bundledVersion,
          toVersion: input.version ?? tool.bundledVersion,
          status: failureCode ? "failed" : "completed",
          failureCode,
          jobId: null,
        },
        now(),
      );
      if ("failureCode" in result) {
        const code = result.failureCode.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        throw conflict("AI tool version not activated", `ai_tool_${code}`);
      }
      return result.tool;
    },
  };
}

export type AiToolsService = ReturnType<typeof createAiToolsService>;
