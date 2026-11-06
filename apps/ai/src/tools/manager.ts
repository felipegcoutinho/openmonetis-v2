import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type AiProvider, aiProviders } from "@openmonetis/domain/ai-providers";
import {
  type AiToolEventStatus,
  type AiToolFailureCode,
  type AiToolInstallStep,
  aiToolReleaseEligibleAt,
  aiToolUpdateBlocker,
  aiToolVersionsToRemove,
  isAiToolVersion,
} from "@openmonetis/domain/ai-tools";
import { z } from "zod";
import type { ProviderAdapter } from "../providers/provider";
import { createCliEnvironment } from "../utils/env";
import { runCommand } from "../utils/process";
import { downloadVerified, extractArchive, makeReadOnly, removeInstallation } from "./download";
import { ToolError, type ToolSource } from "./sources";

const smokeTestTimeoutMs = 30_000;
const latestLifetimeMs = 60 * 60_000;
const backgroundCheckIntervalMs = 6 * 60 * 60_000;
const backgroundCheckDelayMs = 60_000;
const stagingPrefix = ".staging-";

export type ToolJob = {
  jobId: string;
  provider: AiProvider;
  version: string;
  status: AiToolEventStatus;
  step: AiToolInstallStep;
  failureCode: AiToolFailureCode | null;
  startedAt: string;
};

export type ToolSummary = {
  provider: AiProvider;
  bundledVersion: string | null;
  activeVersion: string | null;
  previousVersion: string | null;
  latest: {
    version: string;
    releasedAt: string;
    eligibleAt: string;
    blocker: AiToolFailureCode | null;
  } | null;
  job: ToolJob | null;
};

const versionSchema = z.string().refine(isAiToolVersion);
const providerStateSchema = z.object({
  active: versionSchema.nullable().default(null),
  previous: versionSchema.nullable().default(null),
  installed: z.array(versionSchema).default([]),
  /** When this service first saw each release and, when the source says, when it was published. */
  releases: z
    .record(
      versionSchema,
      z.object({ seenAt: z.iso.datetime(), publishedAt: z.iso.datetime().nullable() }),
    )
    .default({}),
});
const stateSchema = z.object({
  providers: z.partialRecord(z.enum(aiProviders), providerStateSchema).default({}),
});
type ProviderState = z.infer<typeof providerStateSchema>;

const canarySchema = {
  type: "object",
  properties: { ok: { type: "boolean" } },
  required: ["ok"],
  additionalProperties: false,
};

/**
 * Installs reviewed vendor CLI releases into the tools volume and decides which build each
 * provider runs. The image's build is always the fallback; a version is activated only after its
 * signature, digest and commands were checked, and it is deleted only when no run is using it.
 */
export function createToolManager(options: {
  directory: string;
  /** Command of the build shipped with the image, per provider. */
  bundled: Record<AiProvider, string>;
  sources: ToolSource[];
  createAdapter: (provider: AiProvider, command: string) => ProviderAdapter;
  request?: typeof fetch;
  now?: () => Date;
}) {
  const directory = path.resolve(options.directory);
  const statePath = path.join(directory, "state.json");
  const sources = new Map(options.sources.map((source) => [source.provider, source]));
  const now = options.now ?? (() => new Date());
  let state: z.infer<typeof stateSchema> = { providers: {} };
  const leases = new Map<string, number>();
  const jobs = new Map<AiProvider, ToolJob>();
  const latest = new Map<AiProvider, { version: string; checkedAt: number }>();
  const bundledVersions = new Map<AiProvider, Promise<string | null>>();
  let running: ToolJob | null = null;

  function providerState(provider: AiProvider): ProviderState {
    let current = state.providers[provider];
    if (!current) {
      current = providerStateSchema.parse({});
      state.providers[provider] = current;
    }
    return current;
  }

  async function save() {
    const temporary = `${statePath}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, statePath);
  }

  function installationOf(provider: AiProvider, version: string) {
    return path.join(directory, provider, version);
  }

  function binaryOf(provider: AiProvider, version: string) {
    const source = sources.get(provider);
    return source ? path.join(installationOf(provider, version), source.binary) : null;
  }

  async function isExecutable(file: string) {
    return access(file, constants.X_OK).then(
      () => true,
      () => false,
    );
  }

  /** Runs a build's `--version` with a throwaway home, so no sign-in or setting is touched. */
  async function probe(command: string, args: string[]) {
    const home = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-tool-"));
    try {
      return await runCommand(command, args, {
        cwd: home,
        env: createCliEnvironment({ HOME: home }),
        timeoutMs: smokeTestTimeoutMs,
      });
    } finally {
      await rm(home, { recursive: true, force: true });
    }
  }

  function bundledVersion(provider: AiProvider) {
    let version = bundledVersions.get(provider);
    if (!version) {
      version = probe(options.bundled[provider], ["--version"])
        .then((result) => `${result.stdout}\n${result.stderr}`.match(/\b(\d+\.\d+\.\d+)\b/)?.[1])
        .then((value) => (value && isAiToolVersion(value) ? value : null))
        .catch(() => null);
      bundledVersions.set(provider, version);
    }
    return version;
  }

  async function releaseOf(provider: AiProvider, version: string) {
    const current = providerState(provider);
    let release = current.releases[version];
    if (!release) {
      const publishedAt = await sources
        .get(provider)
        ?.publishedAt(version)
        .catch(() => null);
      release = { seenAt: now().toISOString(), publishedAt: publishedAt?.toISOString() ?? null };
      current.releases[version] = release;
      await save();
    }
    // Without a publication date, the waiting period counts from when this service saw it.
    return new Date(release.publishedAt ?? release.seenAt);
  }

  async function latestOf(provider: AiProvider, force = false) {
    const cached = latest.get(provider) ?? null;
    if (cached && !force && now().getTime() - cached.checkedAt < latestLifetimeMs) {
      return cached.version;
    }
    const release = await sources
      .get(provider)
      ?.latest()
      .catch(() => null);
    // An unreachable source keeps the last answer instead of hiding a known release.
    if (!release) return cached?.version ?? null;
    latest.set(provider, { version: release.version, checkedAt: now().getTime() });
    await releaseOf(provider, release.version);
    return release.version;
  }

  async function blockerOf(provider: AiProvider, version: string) {
    const current = providerState(provider);
    return aiToolUpdateBlocker({
      candidate: version,
      current: current.active ?? (await bundledVersion(provider)),
      releasedAt: await releaseOf(provider, version),
      now: now(),
    });
  }

  async function summary(provider: AiProvider): Promise<ToolSummary> {
    const current = providerState(provider);
    const version = await latestOf(provider);
    let release: ToolSummary["latest"] = null;
    if (version) {
      const releasedAt = await releaseOf(provider, version);
      release = {
        version,
        releasedAt: releasedAt.toISOString(),
        eligibleAt: aiToolReleaseEligibleAt(releasedAt).toISOString(),
        blocker: await blockerOf(provider, version),
      };
    }
    return {
      provider,
      bundledVersion: await bundledVersion(provider),
      activeVersion: current.active,
      previousVersion: current.previous,
      latest: release,
      job: jobs.get(provider) ?? null,
    };
  }

  function inUse(provider: AiProvider) {
    return [...leases.entries()]
      .filter(([key, count]) => count > 0 && key.startsWith(`${provider}@`))
      .map(([key]) => key.slice(provider.length + 1));
  }

  async function cleanup(provider: AiProvider) {
    const current = providerState(provider);
    const removable = aiToolVersionsToRemove({
      installed: current.installed,
      active: current.active,
      previous: current.previous,
      bundled: await bundledVersion(provider),
      inUse: inUse(provider),
    });
    if (!removable.length) return;
    for (const version of removable) {
      await removeInstallation(installationOf(provider, version));
    }
    current.installed = current.installed.filter((version) => !removable.includes(version));
    if (current.previous && removable.includes(current.previous)) current.previous = null;
    await save();
  }

  async function setActive(provider: AiProvider, version: string | null) {
    const current = providerState(provider);
    const old = current.active;
    if (old === version) return;
    current.active = version;
    // The version left behind becomes the one to go back to.
    current.previous = old ?? (current.previous === version ? null : current.previous);
    await save();
    await cleanup(provider);
  }

  async function smokeTest(source: ToolSource, binary: string, version: string) {
    const reported = await probe(binary, ["--version"]);
    if (reported.exitCode !== 0 || !`${reported.stdout}${reported.stderr}`.includes(version)) {
      throw new ToolError("smokeTestFailed");
    }
    for (const test of source.smokeTests) {
      const result = await probe(binary, test.args);
      const output = `${result.stdout}\n${result.stderr}`;
      if (result.exitCode !== 0 || !test.tokens.every((token) => output.includes(token))) {
        throw new ToolError("smokeTestFailed");
      }
    }
  }

  /** A short diagnosis with the admin's own sign-in, to catch a changed output format. */
  async function canary(provider: AiProvider, binary: string, home: string) {
    const workDirectory = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-canary-"));
    try {
      const result = await options.createAdapter(provider, binary).run(home, {
        instructions: 'Responda somente com o JSON {"ok": true}.',
        prompt: "Teste de nova versão do OpenMonetis.",
        schema: canarySchema,
        model: null,
        workDirectory,
      });
      const output = result.status === "completed" ? (result.output as { ok?: unknown }) : null;
      if (output?.ok !== true) throw new ToolError("canaryFailed");
    } finally {
      await rm(workDirectory, { recursive: true, force: true });
    }
  }

  async function perform(job: ToolJob, canaryHome: string | null) {
    const source = sources.get(job.provider);
    if (!source) throw new ToolError("unknownVersion");
    const current = providerState(job.provider);
    const target = installationOf(job.provider, job.version);
    const binary = path.join(target, source.binary);

    if (!current.installed.includes(job.version) || !(await isExecutable(binary))) {
      await mkdir(path.join(directory, job.provider), { recursive: true, mode: 0o700 });
      const staging = await mkdtemp(path.join(directory, job.provider, stagingPrefix));
      try {
        const artifact = await source.artifact(job.version);
        await downloadVerified(artifact, path.join(staging, "archive"), options.request);
        job.step = "verify";
        const unpacked = path.join(staging, "unpacked");
        await mkdir(unpacked);
        await extractArchive(path.join(staging, "archive"), unpacked);
        const candidate = path.join(unpacked, source.binary);
        if (!(await isExecutable(candidate))) throw new ToolError("installFailed");
        job.step = "test";
        await smokeTest(source, candidate, job.version);
        if (canaryHome) await canary(job.provider, candidate, canaryHome);
        await removeInstallation(target);
        // Moving a directory needs write access to it, so it is locked once in place.
        await rename(unpacked, target);
        await makeReadOnly(target);
        if (!current.installed.includes(job.version)) current.installed.push(job.version);
        await save();
      } finally {
        await removeInstallation(staging);
      }
    } else {
      job.step = "test";
      await smokeTest(source, binary, job.version);
      if (canaryHome) await canary(job.provider, binary, canaryHome);
    }

    job.step = "activate";
    await setActive(job.provider, job.version);
  }

  return {
    /** Reads the saved state and drops leftovers of installs interrupted by a restart. */
    async load() {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const saved = await readFile(statePath, "utf8").catch(() => null);
      const parsed = saved ? stateSchema.safeParse(JSON.parse(saved)) : null;
      state = parsed?.success ? parsed.data : { providers: {} };
      for (const provider of aiProviders) {
        const providerDirectory = path.join(directory, provider);
        const entries = await readdir(providerDirectory).catch(() => [] as string[]);
        for (const entry of entries) {
          if (entry.startsWith(stagingPrefix)) {
            await removeInstallation(path.join(providerDirectory, entry));
          }
        }
        const current = providerState(provider);
        const present: string[] = [];
        for (const version of current.installed) {
          const binary = binaryOf(provider, version);
          if (binary && (await isExecutable(binary))) present.push(version);
        }
        current.installed = present;
        if (current.active && !present.includes(current.active)) current.active = null;
        if (current.previous && !present.includes(current.previous)) current.previous = null;
      }
      await save();
    },

    /** The command a provider runs now: the active installed build or the image's. */
    command(provider: AiProvider) {
      const active = state.providers[provider]?.active;
      return (active && binaryOf(provider, active)) || options.bundled[provider];
    },

    /** Marks the active build as in use until the returned function is called. */
    hold(provider: AiProvider) {
      const key = `${provider}@${state.providers[provider]?.active ?? "bundled"}`;
      leases.set(key, (leases.get(key) ?? 0) + 1);
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const remaining = Math.max(0, (leases.get(key) ?? 1) - 1);
        leases.set(key, remaining);
        // A version kept only because a run was using it can go now.
        if (remaining === 0) void cleanup(provider).catch(() => undefined);
      };
    },

    list() {
      return Promise.all(aiProviders.map((provider) => summary(provider)));
    },

    job(provider: AiProvider, jobId: string) {
      const job = jobs.get(provider);
      return job?.jobId === jobId ? job : null;
    },

    /** Starts installing `version` in the background; one install runs at a time. */
    async install(
      provider: AiProvider,
      version: string,
      canaryHome: string | null,
    ): Promise<ToolJob> {
      const job: ToolJob = {
        jobId: randomUUID(),
        provider,
        version,
        status: "pending",
        step: "download",
        failureCode: null,
        startedAt: now().toISOString(),
      };
      if (running) return { ...job, status: "failed", failureCode: "busy" };
      // Reserved before the release lookup, so two requests at once cannot both start.
      running = job;
      const blocker: AiToolFailureCode | null = await blockerOf(provider, version).catch(
        () => "downloadFailed" as const,
      );
      if (blocker) {
        running = null;
        return { ...job, status: "failed", failureCode: blocker };
      }

      jobs.set(provider, job);
      void perform(job, canaryHome)
        .then(() => {
          job.status = "completed";
        })
        .catch((error: unknown) => {
          if (!(error instanceof ToolError))
            console.error("AI tool install failed", provider, error);
          job.status = "failed";
          job.failureCode = error instanceof ToolError ? error.code : "installFailed";
        })
        .finally(() => {
          if (running === job) running = null;
        });
      return job;
    },

    /** Switches to an installed version, or back to the image's with `null`. */
    async activate(provider: AiProvider, version: string | null) {
      if (running?.provider === provider) throw new ToolError("busy");
      if (version !== null && !providerState(provider).installed.includes(version)) {
        throw new ToolError("unknownVersion");
      }
      await setActive(provider, version);
      return summary(provider);
    },

    /** Looks for new releases now and then, so the waiting period starts when they appear. */
    startBackgroundChecks() {
      const check = () => {
        for (const provider of aiProviders) void latestOf(provider, true).catch(() => undefined);
      };
      setTimeout(check, backgroundCheckDelayMs).unref();
      setInterval(check, backgroundCheckIntervalMs).unref();
    },
  };
}

export type ToolManager = ReturnType<typeof createToolManager>;
