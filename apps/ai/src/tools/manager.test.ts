import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { ProviderAdapter } from "../providers/provider";
import { createToolManager, type ToolJob, type ToolManager } from "./manager";
import { createToolSources, hasValidNpmSignature, ToolError, type ToolSource } from "./sources";

const day = 24 * 60 * 60 * 1000;
const now = new Date("2026-11-10T12:00:00.000Z");

/** A build whose `--help` lists `tokens` and whose `--version` prints `version`. */
async function packBuild(root: string, version: string, tokens = "--print --json") {
  const source = await mkdtemp(path.join(root, "build-"));
  const binary = path.join(source, "tool");
  await writeFile(
    binary,
    `#!/bin/sh\ncase "$1" in\n  --version) echo "fake ${version}" ;;\n  --help) echo "${tokens}" ;;\n  *) exit 2 ;;\nesac\n`,
  );
  await chmod(binary, 0o755);
  const archive = path.join(root, `tool-${version}-${tokens.length}.tgz`);
  const packed = spawnSync("tar", ["-czf", archive, "-C", source, "tool"]);
  assert.equal(packed.status, 0);
  const bytes = await readFile(archive);
  return { bytes, sha512: createHash("sha512").update(bytes).digest() };
}

function fakeSource(
  builds: Map<string, { bytes: Buffer; sha512: Buffer }>,
  options: { latest?: string; publishedAt?: Date | null; sha512?: Buffer } = {},
): { source: ToolSource; request: typeof fetch } {
  const source: ToolSource = {
    provider: "claude",
    binary: "tool",
    smokeTests: [{ args: ["--help"], tokens: ["--print", "--json"] }],
    async latest() {
      return options.latest ? { version: options.latest, publishedAt: null } : null;
    },
    async publishedAt() {
      return options.publishedAt === undefined
        ? new Date(now.getTime() - 10 * day)
        : options.publishedAt;
    },
    async artifact(version) {
      const build = builds.get(version);
      if (!build) throw new ToolError("unknownVersion");
      return {
        url: `https://downloads.test/${version}.tgz`,
        sha512: options.sha512 ?? build.sha512,
      };
    },
  };
  const request = (async (input: string | URL | Request) => {
    const version = String(input).match(/\/([\d.]+)\.tgz$/)?.[1] ?? "";
    const build = builds.get(version);
    return build
      ? new Response(new Uint8Array(build.bytes))
      : new Response("missing", { status: 404 });
  }) as typeof fetch;
  return { source, request };
}

async function withManager(
  setup: (root: string) => Promise<{ source: ToolSource; request: typeof fetch }>,
  callback: (manager: ToolManager, root: string) => Promise<void>,
  adapter?: (command: string) => ProviderAdapter,
) {
  const root = await mkdtemp(path.join(os.tmpdir(), "openmonetis-ai-tools-test-"));
  try {
    const bundled = path.join(root, "bundled-claude");
    await writeFile(bundled, '#!/bin/sh\necho "2.0.0 (bundled)"\n');
    await chmod(bundled, 0o755);
    const { source, request } = await setup(root);
    const manager = createToolManager({
      directory: path.join(root, "tools"),
      bundled: { claude: bundled, codex: "codex-missing", antigravity: "agy-missing" },
      sources: [source],
      createAdapter: (_provider, command) => {
        if (!adapter) throw new Error("no adapter");
        return adapter(command);
      },
      request,
      now: () => now,
    });
    await manager.load();
    await callback(manager, root);
  } finally {
    await chmodTree(root);
    await rm(root, { recursive: true, force: true });
  }
}

async function chmodTree(target: string) {
  const info = await stat(target).catch(() => null);
  if (!info) return;
  await chmod(target, info.mode | 0o700).catch(() => undefined);
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) await chmodTree(path.join(target, entry));
  }
}

async function finish(manager: ToolManager, started: ToolJob) {
  let job = started;
  for (let attempt = 0; attempt < 200 && job.status === "pending"; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20));
    job = manager.job("claude", job.jobId) ?? job;
  }
  return job;
}

test("a verified build is installed read-only, activated and saved", async () => {
  await withManager(
    async (root) =>
      fakeSource(new Map([["2.0.5", await packBuild(root, "2.0.5")]]), { latest: "2.0.5" }),
    async (manager, root) => {
      const [summary] = await manager.list();
      assert.equal(summary?.bundledVersion, "2.0.0");
      assert.equal(summary?.latest?.version, "2.0.5");
      assert.equal(summary?.latest?.blocker, null);

      const job = await finish(manager, await manager.install("claude", "2.0.5", null));
      assert.equal(job.status, "completed");
      const binary = path.join(root, "tools", "claude", "2.0.5", "tool");
      assert.equal(manager.command("claude"), binary);
      assert.equal((await stat(binary)).mode & 0o222, 0, "no write permission");
      assert.deepEqual(
        (await readdir(path.join(root, "tools", "claude"))).filter((entry) =>
          entry.startsWith("."),
        ),
        [],
      );

      const state = JSON.parse(await readFile(path.join(root, "tools", "state.json"), "utf8"));
      assert.equal(state.providers.claude.active, "2.0.5");
      const [after] = await manager.list();
      assert.equal(after?.latest?.blocker, "notNewer");
    },
  );
});

test("a build whose digest does not match is never extracted or activated", async () => {
  await withManager(
    async (root) =>
      fakeSource(new Map([["2.0.5", await packBuild(root, "2.0.5")]]), {
        latest: "2.0.5",
        sha512: Buffer.alloc(64, 1),
      }),
    async (manager, root) => {
      const job = await finish(manager, await manager.install("claude", "2.0.5", null));
      assert.equal(job.status, "failed");
      assert.equal(job.failureCode, "integrityMismatch");
      assert.equal(manager.command("claude"), path.join(root, "bundled-claude"));
      assert.deepEqual(await readdir(path.join(root, "tools", "claude")), []);
    },
  );
});

test("a build missing a flag the adapters use fails its smoke test", async () => {
  await withManager(
    async (root) =>
      fakeSource(new Map([["2.0.5", await packBuild(root, "2.0.5", "--print only")]]), {
        latest: "2.0.5",
      }),
    async (manager, root) => {
      const job = await finish(manager, await manager.install("claude", "2.0.5", null));
      assert.equal(job.failureCode, "smokeTestFailed");
      assert.equal(manager.command("claude"), path.join(root, "bundled-claude"));
    },
  );
});

test("a release without a publication date waits three days from when it was first seen", async () => {
  await withManager(
    async (root) =>
      fakeSource(new Map([["2.0.5", await packBuild(root, "2.0.5")]]), {
        latest: "2.0.5",
        publishedAt: null,
      }),
    async (manager) => {
      const [summary] = await manager.list();
      assert.equal(summary?.latest?.blocker, "tooRecent");
      assert.equal(summary?.latest?.eligibleAt, new Date(now.getTime() + 3 * day).toISOString());
      const job = await manager.install("claude", "2.0.5", null);
      assert.equal(job.failureCode, "tooRecent");
    },
  );
});

test("going back keeps both versions, and a version in use is not deleted", async () => {
  await withManager(
    async (root) =>
      fakeSource(
        new Map([
          ["2.0.5", await packBuild(root, "2.0.5")],
          ["2.0.6", await packBuild(root, "2.0.6")],
          ["2.0.7", await packBuild(root, "2.0.7")],
        ]),
        { latest: "2.0.7" },
      ),
    async (manager, root) => {
      const installed = (version: string) =>
        access(path.join(root, "tools", "claude", version)).then(
          () => true,
          () => false,
        );
      await finish(manager, await manager.install("claude", "2.0.5", null));
      const release = manager.hold("claude");
      await finish(manager, await manager.install("claude", "2.0.6", null));
      await finish(manager, await manager.install("claude", "2.0.7", null));
      // 2.0.5 is neither active nor previous, but a run still uses it.
      assert.equal(await installed("2.0.5"), true);
      release();
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(await installed("2.0.5"), false);

      let summary = await manager.activate("claude", "2.0.6");
      assert.equal(summary.activeVersion, "2.0.6");
      assert.equal(summary.previousVersion, "2.0.7");
      summary = await manager.activate("claude", null);
      assert.equal(summary.activeVersion, null);
      assert.equal(summary.previousVersion, "2.0.6");
      assert.equal(manager.command("claude"), path.join(root, "bundled-claude"));
      await assert.rejects(manager.activate("claude", "2.0.5"), ToolError);
    },
  );
});

test("the optional canary runs the new build with the admin's sign-in before activating", async () => {
  const commands: string[] = [];
  await withManager(
    async (root) =>
      fakeSource(new Map([["2.0.5", await packBuild(root, "2.0.5")]]), { latest: "2.0.5" }),
    async (manager, root) => {
      const home = path.join(root, "admin-home");
      await mkdir(home);
      const job = await finish(manager, await manager.install("claude", "2.0.5", home));
      assert.equal(job.failureCode, "canaryFailed");
      assert.equal(commands.length, 1);
      assert.match(commands[0] ?? "", /\.staging-/);
      assert.equal(manager.command("claude"), path.join(root, "bundled-claude"));
    },
    (command) => {
      commands.push(command);
      return {
        run: async () => ({ status: "completed", output: { ok: false }, model: null }),
      } as unknown as ProviderAdapter;
    },
  );
});

test("npm builds need the registry signature from a pinned key", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const keys = {
    "SHA256:test": publicKey.export({ format: "der", type: "spki" }).toString("base64"),
  };
  const integrity = `sha512-${Buffer.alloc(64, 7).toString("base64")}`;
  const signed = (name: string, version: string) => ({
    name,
    version,
    dist: {
      tarball: `https://registry.npmjs.org/${name}/-/x.tgz`,
      integrity,
      signatures: [
        {
          keyid: "SHA256:test",
          sig: sign("sha256", Buffer.from(`${name}@${version}:${integrity}`), privateKey).toString(
            "base64",
          ),
        },
      ],
    },
  });
  const good = signed("@anthropic-ai/claude-code-linux-x64", "2.1.400");
  assert.equal(hasValidNpmSignature(good, keys), true);
  assert.equal(hasValidNpmSignature({ ...good, version: "2.1.401" }, keys), false);
  assert.equal(hasValidNpmSignature(good), false, "unknown key id");

  const responses: Record<string, unknown> = {
    "https://registry.npmjs.org/@anthropic-ai%2fclaude-code-linux-x64/2.1.400": good,
    "https://registry.npmjs.org/@anthropic-ai%2fclaude-code-linux-x64/2.1.401": {
      ...signed("@anthropic-ai/claude-code-linux-x64", "2.1.401"),
      version: "2.1.401",
      dist: { ...good.dist },
    },
  };
  const request = (async (input: string | URL | Request) =>
    Response.json(responses[String(input)] ?? {}, {
      status: responses[String(input)] ? 200 : 404,
    })) as typeof fetch;
  const claude = createToolSources({
    platform: { os: "linux", arch: "x64" },
    request,
    npmSigningKeys: keys,
  }).find((source) => source.provider === "claude");
  const artifact = await claude?.artifact("2.1.400");
  assert.equal(artifact?.sha512.length, 64);
  await assert.rejects(claude?.artifact("2.1.401") ?? Promise.reject(), (error: unknown) => {
    return error instanceof ToolError && error.code === "signatureInvalid";
  });
});

test("two installs requested at once never both start", async () => {
  await withManager(
    async (root) =>
      fakeSource(new Map([["2.0.5", await packBuild(root, "2.0.5")]]), { latest: "2.0.5" }),
    async (manager) => {
      const [first, second] = await Promise.all([
        manager.install("claude", "2.0.5", null),
        manager.install("claude", "2.0.5", null),
      ]);
      assert.deepEqual([first.status, second.status].sort(), ["failed", "pending"]);
      assert.equal([first, second].find((job) => job.status === "failed")?.failureCode, "busy");
      await finish(manager, first.status === "pending" ? first : second);
    },
  );
});
