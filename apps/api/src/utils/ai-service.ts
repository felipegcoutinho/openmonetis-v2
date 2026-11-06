import { createHmac } from "node:crypto";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { aiToolFailureCodes } from "@openmonetis/domain/ai-tools";
import type { ApiSuccess } from "@openmonetis/shared/api";
import type { AiProviderModel } from "@openmonetis/validators/ai-providers";
import type { AiToolJobOutput, AiToolOutput } from "@openmonetis/validators/ai-tools";
import { z } from "zod";
import type { AiChatRunEvent, AiChatRunner } from "../services/ai-chats.service";
import type { AiDiagnosisRunner } from "../services/ai-diagnoses.service";
import type { AiProviderLogin, AiProvidersGateway } from "../services/ai-providers.service";
import type { AiToolsGateway } from "../services/ai-tools.service";
import { assertProductionSecret, getRequiredProductionEnv, parseBooleanEnv } from "./env";

const statusTimeoutMs = 20_000;
const loginTimeoutMs = 90_000;
/** Longer than the slowest CLI run (Antigravity, 270 s) and shorter than a pending diagnosis lives. */
const runTimeoutMs = 285_000;
const chatTimeoutMs = 285_000;
/** Listing reads each vendor's release metadata, which can take a while on a cold cache. */
const toolsTimeoutMs = 60_000;

const AiToolFailureCodeSchema = z.enum(aiToolFailureCodes);
const AccountEmailSchema = z.email().max(254);

export class AiServiceUnavailableError extends Error {
  constructor() {
    super("AI service unavailable");
    this.name = "AiServiceUnavailableError";
  }
}

type AiServiceGateway = AiProvidersGateway & AiDiagnosisRunner & AiChatRunner & AiToolsGateway;

/**
 * Client for the internal AI service. Users are identified there only by an HMAC of their id, so
 * the service holding vendor sign-ins never learns which OpenMonetis account a home belongs to.
 */
export function createAiServiceGateway(options: {
  enabled: boolean;
  url?: string;
  secret?: string;
  homeSecret?: string;
  request?: typeof fetch;
}): AiServiceGateway {
  const baseUrl = options.url?.replace(/\/+$/, "");
  const enabled = Boolean(options.enabled && baseUrl && options.secret && options.homeSecret);
  const request = options.request ?? fetch;

  function homeIdOf(userId: string) {
    return createHmac("sha256", options.homeSecret ?? "")
      .update(userId, "utf8")
      .digest("hex");
  }

  function homePath(userId: string, provider: AiProvider) {
    return `/homes/${homeIdOf(userId)}/providers/${provider}`;
  }

  async function call<T>(
    path: string,
    init: { method?: string; body?: unknown; timeoutMs: number; conflict?: boolean },
  ): Promise<T | null> {
    if (!enabled) throw new AiServiceUnavailableError();
    let response: Response;
    try {
      response = await request(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers: {
          Authorization: `Bearer ${options.secret}`,
          ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: AbortSignal.timeout(init.timeoutMs),
      });
    } catch {
      throw new AiServiceUnavailableError();
    }
    if (response.status === 404) return null;
    if (init.conflict && response.status === 409) {
      const body = (await response.json().catch(() => null)) as { code?: unknown } | null;
      return { conflict: typeof body?.code === "string" ? body.code : "unknown" } as T;
    }
    if (!response.ok) throw new AiServiceUnavailableError();
    return ((await response.json()) as ApiSuccess<T>).data;
  }

  function login(path: string, body?: unknown) {
    return call<AiProviderLogin>(path, {
      method: body === undefined ? "GET" : "POST",
      body,
      timeoutMs: loginTimeoutMs,
    });
  }

  return {
    enabled,

    async readAccount(userId, provider) {
      const result = await call<{ connected: boolean; email?: unknown }>(
        homePath(userId, provider),
        { timeoutMs: statusTimeoutMs },
      );
      if (result?.connected !== true) return null;
      const email = AccountEmailSchema.safeParse(result.email);
      return { email: email.success ? email.data : null };
    },

    async disconnect(userId, provider) {
      await call(homePath(userId, provider), { method: "DELETE", timeoutMs: statusTimeoutMs });
    },

    async listModels(userId, provider) {
      const result = await call<{ models: AiProviderModel[] }>(
        `${homePath(userId, provider)}/models`,
        {
          timeoutMs: statusTimeoutMs,
        },
      );
      return result?.models ?? [];
    },

    async startLogin(userId, provider) {
      const result = await login(`${homePath(userId, provider)}/logins`, {});
      if (!result) throw new AiServiceUnavailableError();
      return result;
    },

    getLogin(userId, provider, loginId) {
      return login(`${homePath(userId, provider)}/logins/${loginId}`);
    },

    submitLoginCode(userId, provider, loginId, code) {
      return login(`${homePath(userId, provider)}/logins/${loginId}/code`, { code });
    },

    async run(userId, provider, input) {
      const result = await call<Awaited<ReturnType<AiDiagnosisRunner["run"]>>>(
        `${homePath(userId, provider)}/runs`,
        { method: "POST", body: input, timeoutMs: runTimeoutMs },
      );
      if (!result) throw new AiServiceUnavailableError();
      return result;
    },

    /** Reads the AI service NDJSON stream; aborting `signal` closes it and stops the CLI. */
    async *chat(userId, provider, input, signal) {
      if (!enabled) throw new AiServiceUnavailableError();
      let response: Response;
      try {
        response = await request(`${baseUrl}${homePath(userId, provider)}/chats`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${options.secret}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(input),
          signal: AbortSignal.any([signal, AbortSignal.timeout(chatTimeoutMs)]),
        });
      } catch (error) {
        if (signal.aborted) throw error;
        throw new AiServiceUnavailableError();
      }
      if (!response.ok || !response.body) throw new AiServiceUnavailableError();

      const decoder = new TextDecoder();
      let buffer = "";
      for await (const chunk of response.body) {
        buffer += decoder.decode(chunk as Uint8Array, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const event = parseChatEvent(line);
          if (event) yield event;
        }
      }
      const last = parseChatEvent(buffer);
      if (last) yield last;
    },

    async listTools() {
      const result = await call<{ items: AiToolOutput[] }>("/tools", { timeoutMs: toolsTimeoutMs });
      if (!result) throw new AiServiceUnavailableError();
      return result.items;
    },

    async installTool(provider, version, canaryUserId) {
      const result = await call<AiToolJobOutput>(`/tools/${provider}/installs`, {
        method: "POST",
        body: { version, canaryHomeId: canaryUserId ? homeIdOf(canaryUserId) : null },
        timeoutMs: toolsTimeoutMs,
      });
      if (!result) throw new AiServiceUnavailableError();
      return result;
    },

    getToolJob(provider, jobId) {
      return call<AiToolJobOutput>(`/tools/${provider}/installs/${jobId}`, {
        timeoutMs: statusTimeoutMs,
      });
    },

    async activateTool(provider, version) {
      const result = await call<AiToolOutput | { conflict: string }>(`/tools/${provider}/active`, {
        method: "PUT",
        body: { version },
        timeoutMs: toolsTimeoutMs,
        conflict: true,
      });
      if (!result) throw new AiServiceUnavailableError();
      if ("conflict" in result) {
        const parsed = AiToolFailureCodeSchema.safeParse(result.conflict);
        return { failureCode: parsed.success ? parsed.data : "installFailed" };
      }
      return { tool: result };
    },

    async cancel(userId, provider) {
      await call(`${homePath(userId, provider)}/runs/current`, {
        method: "DELETE",
        timeoutMs: statusTimeoutMs,
      });
    },
  };
}

function parseChatEvent(line: string): AiChatRunEvent | null {
  if (!line.trim()) return null;
  try {
    const event = JSON.parse(line) as { type?: unknown };
    return typeof event.type === "string" ? (event as AiChatRunEvent) : null;
  } catch {
    return null;
  }
}

const aiServiceEnabled = parseBooleanEnv("AI_ENABLED");
const developmentServiceSecret = "development-ai-service-secret-change-me";
const developmentHomeSecret = "development-ai-home-secret-change-me";

export const aiServiceGateway = createAiServiceGateway({
  enabled: aiServiceEnabled,
  url: aiServiceEnabled
    ? getRequiredProductionEnv("AI_SERVICE_URL", "http://localhost:7003")
    : undefined,
  secret: aiServiceEnabled
    ? (assertProductionSecret("AI_SERVICE_SECRET", [developmentServiceSecret]) ??
      developmentServiceSecret)
    : undefined,
  homeSecret: aiServiceEnabled
    ? (assertProductionSecret("AI_HOME_SECRET", [developmentHomeSecret]) ?? developmentHomeSecret)
    : undefined,
});
