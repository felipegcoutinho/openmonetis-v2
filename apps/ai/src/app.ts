import { createHash, timingSafeEqual } from "node:crypto";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  aiProviderLoginCodeMaximumLength,
  aiProviderModelIdPattern,
  aiProviders,
} from "@openmonetis/domain/ai-providers";
import { aiToolVersionPattern } from "@openmonetis/domain/ai-tools";
import { fail, ok } from "@openmonetis/shared/api";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createMiddleware } from "hono/factory";
import { stream } from "hono/streaming";
import { z } from "zod";
import { createLoginSessions, type LoginSessions } from "./login-sessions";
import type { ProviderAccount, ProviderAdapter, ProviderModel } from "./providers/provider";
import type { ToolManager } from "./tools/manager";
import { ToolError } from "./tools/sources";

const homeParamsSchema = z.object({
  homeId: z.string().regex(/^[a-f0-9]{64}$/),
  provider: z.enum(aiProviders),
});
const loginParamsSchema = homeParamsSchema.extend({ loginId: z.uuid() });
const loginCodeSchema = z
  .object({ code: z.string().trim().min(1).max(aiProviderLoginCodeMaximumLength) })
  .strict();
const runSchema = z
  .object({
    instructions: z.string().min(1).max(20_000),
    prompt: z.string().min(1).max(200_000),
    schema: z.record(z.string(), z.unknown()),
    model: z.string().regex(aiProviderModelIdPattern).nullable().default(null),
  })
  .strict();
const chatSchema = runSchema.omit({ schema: true });
const toolParamsSchema = z.object({ provider: z.enum(aiProviders) });
const toolJobParamsSchema = toolParamsSchema.extend({ jobId: z.uuid() });
const toolInstallSchema = z
  .object({
    version: z.string().regex(aiToolVersionPattern),
    /** The admin's home, when they asked for a short test run with their own sign-in. */
    canaryHomeId: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .nullable()
      .default(null),
  })
  .strict();
const toolActivateSchema = z
  .object({ version: z.string().regex(aiToolVersionPattern).nullable() })
  .strict();
const modelCatalogLifetimeMs = 10 * 60_000;
/**
 * Reading a sign-in starts the vendor CLI (Codex also starts its app server), which takes seconds
 * and runs on every page that lists the providers. Only a confirmed sign-in is kept, so a new or
 * finished sign-in is always read again; a run with a revoked one still fails on its own.
 */
const accountLifetimeMs = 2 * 60_000;

type AiServiceOptions = {
  secret: string;
  homesDirectory: string;
  providers: ProviderAdapter[];
  loginSessions?: LoginSessions;
  /** Installs newer CLI builds; without it the image's builds are always used. */
  tools?: ToolManager;
};

/**
 * Internal service that hosts the provider CLIs. It is reachable only by the OpenMonetis API,
 * never touches the database and knows each user only by an opaque home id.
 */
export function createAiServiceApp(options: AiServiceOptions) {
  const app = new Hono();
  const providers = new Map(options.providers.map((adapter) => [adapter.provider, adapter]));
  const loginSessions = options.loginSessions ?? createLoginSessions();
  /** One run per home at a time; the controller lets the API stop it. */
  const activeRuns = new Map<string, AbortController>();
  // CLIs run with their home as working directory, so a relative root would resolve twice.
  const homesDirectory = path.resolve(options.homesDirectory);
  const expectedSecret = digest(options.secret);
  const modelCatalogs = new Map<string, { models: ProviderModel[]; expiresAt: number }>();
  const accounts = new Map<string, { account: ProviderAccount; expiresAt: number }>();
  const tools = options.tools;

  /** Keeps the CLI build a call runs from being deleted until the call ends. */
  async function using<T>(provider: ProviderAdapter["provider"], operation: () => Promise<T>) {
    const release = tools?.hold(provider);
    try {
      return await operation();
    } finally {
      release?.();
    }
  }

  async function homeOf(homeId: string, provider: string) {
    const home = path.join(homesDirectory, homeId, provider);
    await mkdir(home, { recursive: true, mode: 0o700 });
    return home;
  }

  function parse<T extends z.ZodType>(schema: T, value: unknown) {
    const result = schema.safeParse(value);
    return result.success ? result.data : null;
  }

  app.get("/health", (context) => context.json(ok({ status: "ok" as const })));

  const requireSecret = createMiddleware(async (context, next) => {
    const header = context.req.header("authorization") ?? "";
    const provided = digest(header.startsWith("Bearer ") ? header.slice(7) : "");
    if (!timingSafeEqual(provided, expectedSecret)) {
      return context.json(fail("Unauthorized", "unauthorized"), 401);
    }
    context.header("Cache-Control", "private, no-store");
    await next();
  });
  app.use("/homes/*", requireSecret);
  app.use("/homes/*", bodyLimit({ maxSize: 256 * 1024 }));
  app.use("/tools", requireSecret);
  app.use("/tools/*", requireSecret);
  app.use("/tools/*", bodyLimit({ maxSize: 16 * 1024 }));

  app.get("/homes/:homeId/providers/:provider", async (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    const adapter = params && providers.get(params.provider);
    if (!params || !adapter) return context.json(fail("Not found", "not_found"), 404);
    const ownerKey = `${params.homeId}:${params.provider}`;
    const cached = accounts.get(ownerKey);
    if (cached && cached.expiresAt > Date.now()) {
      return context.json(ok({ connected: true, email: cached.account.email }));
    }
    const home = await homeOf(params.homeId, params.provider);
    const account = await using(params.provider, () => adapter.readAccount(home));
    if (account) accounts.set(ownerKey, { account, expiresAt: Date.now() + accountLifetimeMs });
    else accounts.delete(ownerKey);
    return context.json(ok({ connected: account !== null, email: account?.email ?? null }));
  });

  app.delete("/homes/:homeId/providers/:provider", async (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    const adapter = params && providers.get(params.provider);
    if (!params || !adapter) return context.json(fail("Not found", "not_found"), 404);
    const ownerKey = `${params.homeId}:${params.provider}`;
    loginSessions.cancelAll(ownerKey);
    modelCatalogs.delete(ownerKey);
    accounts.delete(ownerKey);
    const home = await homeOf(params.homeId, params.provider);
    await using(params.provider, () => adapter.logout(home)).catch(() => undefined);
    await rm(home, { recursive: true, force: true });
    return context.json(ok({ connected: false, email: null }));
  });

  app.get("/homes/:homeId/providers/:provider/models", async (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    const adapter = params && providers.get(params.provider);
    if (!params || !adapter) return context.json(fail("Not found", "not_found"), 404);
    const ownerKey = `${params.homeId}:${params.provider}`;
    const cached = modelCatalogs.get(ownerKey);
    if (cached && cached.expiresAt > Date.now()) return context.json(ok({ models: cached.models }));
    const home = await homeOf(params.homeId, params.provider);
    const models = await using(params.provider, () => adapter.listModels(home));
    if (models.length) {
      modelCatalogs.set(ownerKey, { models, expiresAt: Date.now() + modelCatalogLifetimeMs });
    }
    return context.json(ok({ models }));
  });

  app.post("/homes/:homeId/providers/:provider/logins", async (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    const adapter = params && providers.get(params.provider);
    if (!params || !adapter) return context.json(fail("Not found", "not_found"), 404);
    const home = await homeOf(params.homeId, params.provider);
    modelCatalogs.delete(`${params.homeId}:${params.provider}`);
    accounts.delete(`${params.homeId}:${params.provider}`);
    const release = tools?.hold(params.provider);
    const login = await loginSessions
      .start(`${params.homeId}:${params.provider}`, home, adapter, release)
      .catch((error: unknown) => {
        release?.();
        throw error;
      });
    return context.json(ok(login), 201);
  });

  app.get("/homes/:homeId/providers/:provider/logins/:loginId", (context) => {
    const params = parse(loginParamsSchema, context.req.param());
    const login =
      params && loginSessions.get(`${params.homeId}:${params.provider}`, params.loginId);
    if (!login) return context.json(fail("Not found", "not_found"), 404);
    return context.json(ok(login));
  });

  app.post("/homes/:homeId/providers/:provider/logins/:loginId/code", async (context) => {
    const params = parse(loginParamsSchema, context.req.param());
    const body = parse(loginCodeSchema, await context.req.json().catch(() => null));
    if (!params) return context.json(fail("Not found", "not_found"), 404);
    if (!body) return context.json(fail("Invalid code", "invalid_request"), 400);
    const login = await loginSessions.submitCode(
      `${params.homeId}:${params.provider}`,
      params.loginId,
      body.code,
    );
    if (!login) return context.json(fail("Not found", "not_found"), 404);
    return context.json(ok(login));
  });

  app.post("/homes/:homeId/providers/:provider/runs", async (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    const adapter = params && providers.get(params.provider);
    const body = parse(runSchema, await context.req.json().catch(() => null));
    if (!params || !adapter) return context.json(fail("Not found", "not_found"), 404);
    if (!body) return context.json(fail("Invalid run", "invalid_request"), 400);
    if (activeRuns.has(params.homeId)) {
      return context.json(ok({ status: "failed" as const, code: "providerBusy" as const }));
    }

    const controller = new AbortController();
    activeRuns.set(params.homeId, controller);
    const workDirectory = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-run-"));
    try {
      const home = await homeOf(params.homeId, params.provider);
      const result = await using(params.provider, () =>
        adapter.run(home, { ...body, workDirectory, signal: controller.signal }),
      );
      return context.json(ok(result));
    } catch (error) {
      console.error("AI provider run failed", params.provider, error);
      return context.json(ok({ status: "failed" as const, code: "runFailed" as const }));
    } finally {
      activeRuns.delete(params.homeId);
      await rm(workDirectory, { recursive: true, force: true });
    }
  });

  /**
   * Streams a chat answer as NDJSON: `delta` and `reasoning` events while the CLI writes, then one
   * `completed` or `failed` event. Closing the connection stops the CLI.
   */
  app.post("/homes/:homeId/providers/:provider/chats", async (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    const adapter = params && providers.get(params.provider);
    const body = parse(chatSchema, await context.req.json().catch(() => null));
    if (!params || !adapter) return context.json(fail("Not found", "not_found"), 404);
    if (!body) return context.json(fail("Invalid chat", "invalid_request"), 400);

    context.header("Content-Type", "application/x-ndjson; charset=utf-8");
    return stream(context, async (output) => {
      const write = (event: Record<string, unknown>) => output.write(`${JSON.stringify(event)}\n`);
      if (activeRuns.has(params.homeId)) {
        await write({ type: "failed", code: "providerBusy" });
        return;
      }
      const controller = new AbortController();
      activeRuns.set(params.homeId, controller);
      output.onAbort(() => controller.abort());
      const workDirectory = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-chat-"));
      try {
        const home = await homeOf(params.homeId, params.provider);
        const result = await using(params.provider, () =>
          adapter.chat(
            home,
            { ...body, workDirectory, signal: controller.signal },
            (event) => void write(event),
          ),
        );
        if (result.status === "completed" && result.model) {
          const catalog = modelCatalogs.get(`${params.homeId}:${params.provider}`)?.models ?? [];
          const known = catalog.find((model) => model.id === result.model?.id);
          await write({
            ...result,
            type: "completed",
            model: known ? { id: known.id, name: known.name } : result.model,
          });
        } else {
          await write({ ...result, type: result.status });
        }
      } catch (error) {
        console.error("AI provider chat failed", params.provider, error);
        await write({ type: "failed", code: "runFailed" });
      } finally {
        activeRuns.delete(params.homeId);
        await rm(workDirectory, { recursive: true, force: true });
      }
    });
  });

  app.delete("/homes/:homeId/providers/:provider/runs/current", (context) => {
    const params = parse(homeParamsSchema, context.req.param());
    if (!params || !providers.has(params.provider)) {
      return context.json(fail("Not found", "not_found"), 404);
    }
    const controller = activeRuns.get(params.homeId);
    controller?.abort();
    return context.json(ok({ canceled: Boolean(controller) }));
  });

  app.get("/tools", async (context) => {
    if (!tools) return context.json(fail("Not found", "not_found"), 404);
    return context.json(ok({ items: await tools.list() }));
  });

  app.post("/tools/:provider/installs", async (context) => {
    const params = parse(toolParamsSchema, context.req.param());
    const body = parse(toolInstallSchema, await context.req.json().catch(() => null));
    if (!tools || !params) return context.json(fail("Not found", "not_found"), 404);
    if (!body) return context.json(fail("Invalid install", "invalid_request"), 400);
    const canaryHome = body.canaryHomeId ? await homeOf(body.canaryHomeId, params.provider) : null;
    return context.json(ok(await tools.install(params.provider, body.version, canaryHome)));
  });

  app.get("/tools/:provider/installs/:jobId", (context) => {
    const params = parse(toolJobParamsSchema, context.req.param());
    const job = tools && params && tools.job(params.provider, params.jobId);
    if (!job) return context.json(fail("Not found", "not_found"), 404);
    return context.json(ok(job));
  });

  app.put("/tools/:provider/active", async (context) => {
    const params = parse(toolParamsSchema, context.req.param());
    const body = parse(toolActivateSchema, await context.req.json().catch(() => null));
    if (!tools || !params) return context.json(fail("Not found", "not_found"), 404);
    if (!body) return context.json(fail("Invalid version", "invalid_request"), 400);
    try {
      return context.json(ok(await tools.activate(params.provider, body.version)));
    } catch (error) {
      if (error instanceof ToolError) return context.json(fail("Not activated", error.code), 409);
      throw error;
    }
  });

  app.notFound((context) => context.json(fail("Not found", "not_found"), 404));
  app.onError((error, context) => {
    console.error(error);
    return context.json(fail("Internal error", "internal_error"), 500);
  });

  return app;
}

function digest(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}
