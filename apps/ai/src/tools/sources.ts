import { verify } from "node:crypto";
import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { type AiToolFailureCode, isAiToolVersion } from "@openmonetis/domain/ai-tools";
import { z } from "zod";

/** A failure the admin can be told about; anything else becomes `installFailed`. */
export class ToolError extends Error {
  constructor(readonly code: AiToolFailureCode) {
    super(code);
    this.name = "ToolError";
  }
}

export type ToolPlatform = { os: "linux" | "darwin"; arch: "x64" | "arm64" };

export type ToolRelease = { version: string; publishedAt: Date | null };

/** What to download and the digest it must match before anything is extracted. */
export type ToolArtifact = { url: string; sha512: Buffer };

export type ToolSource = {
  provider: AiProvider;
  /** The newest stable release, or null when the source cannot be read. */
  latest(): Promise<ToolRelease | null>;
  /** When the release was published, if the source says; read once per version. */
  publishedAt(version: string): Promise<Date | null>;
  artifact(version: string): Promise<ToolArtifact>;
  /** The executable inside the extracted archive. */
  binary: string;
  /** Commands the adapters rely on, checked in the new build before it is activated. */
  smokeTests: Array<{ args: string[]; tokens: string[] }>;
};

type Request = typeof fetch;

const npmRegistry = "https://registry.npmjs.org";
const metadataTimeoutMs = 30_000;
const maximumMetadataBytes = 64 * 1024 * 1024;

/**
 * The npm registry's package-signing key, pinned here instead of fetched next to the package it
 * vouches for. A rotation makes updates fail closed until this list is reviewed and extended.
 * https://docs.npmjs.com/about-registry-signatures
 */
const npmSigningKeys: Record<string, string> = {
  "SHA256:DhQ8wR5APBvFHLF/+Tc+AYvPOdTpcIDqOhxsBHRwC7U":
    "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEY6Ya7W++7aUPzvMTrezH6Ycx3c+HOKYCcNGybJZSCJq/fd7Qa8uuAKtdIkUQtQiEKERhAmE5lMMJhP8OkDOa2g==",
};

const npmVersionSchema = z.object({
  name: z.string(),
  version: z.string(),
  dist: z.object({
    tarball: z.url(),
    integrity: z.string().startsWith("sha512-"),
    signatures: z.array(z.object({ keyid: z.string(), sig: z.string() })).default([]),
  }),
});

const npmTimesSchema = z.object({ time: z.record(z.string(), z.string()) });

const antigravityManifestSchema = z.object({
  version: z.string(),
  url: z.url(),
  sha512: z.string().regex(/^[a-f0-9]{128}$/),
});

export function currentToolPlatform(): ToolPlatform | null {
  const os =
    process.platform === "linux" || process.platform === "darwin" ? process.platform : null;
  const arch = process.arch === "x64" || process.arch === "arm64" ? process.arch : null;
  return os && arch ? { os, arch } : null;
}

export async function readJson(request: Request, url: string, headers: HeadersInit = {}) {
  let response: Response;
  try {
    response = await request(url, { headers, signal: AbortSignal.timeout(metadataTimeoutMs) });
  } catch {
    throw new ToolError("downloadFailed");
  }
  if (response.status === 404) throw new ToolError("unknownVersion");
  if (!response.ok) throw new ToolError("downloadFailed");
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > maximumMetadataBytes) throw new ToolError("downloadFailed");
  const text = await response.text();
  if (text.length > maximumMetadataBytes) throw new ToolError("downloadFailed");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ToolError("downloadFailed");
  }
}

function npmPath(name: string) {
  return `${npmRegistry}/${name.replace("/", "%2f")}`;
}

/** Checks the registry signature over `name@version:integrity` with a pinned key. */
export function hasValidNpmSignature(
  pkg: z.infer<typeof npmVersionSchema>,
  keys: Record<string, string> = npmSigningKeys,
) {
  const message = Buffer.from(`${pkg.name}@${pkg.version}:${pkg.dist.integrity}`, "utf8");
  return pkg.dist.signatures.some((signature) => {
    const key = keys[signature.keyid];
    if (!key) return false;
    try {
      return verify(
        "sha256",
        message,
        { key: Buffer.from(key, "base64"), format: "der", type: "spki" },
        Buffer.from(signature.sig, "base64"),
      );
    } catch {
      return false;
    }
  });
}

/**
 * A CLI published on npm as a native build per platform. Only that build is installed, from its
 * own tarball and integrity, so no package script ever runs.
 */
function npmSource(options: {
  provider: AiProvider;
  name: string;
  build: (version: string) => { name: string; version: string };
  binary: string;
  smokeTests: ToolSource["smokeTests"];
  request: Request;
  signingKeys?: Record<string, string>;
}): ToolSource {
  return {
    provider: options.provider,
    binary: options.binary,
    smokeTests: options.smokeTests,

    async latest() {
      const pkg = npmVersionSchema.safeParse(
        await readJson(options.request, `${npmPath(options.name)}/latest`),
      );
      if (!pkg.success || !isAiToolVersion(pkg.data.version)) return null;
      return { version: pkg.data.version, publishedAt: null };
    },

    async publishedAt(version) {
      const times = npmTimesSchema.safeParse(
        await readJson(options.request, npmPath(options.name)),
      );
      const value = times.success ? times.data.time[version] : undefined;
      const date = value ? new Date(value) : null;
      return date && !Number.isNaN(date.getTime()) ? date : null;
    },

    async artifact(version) {
      const build = options.build(version);
      const pkg = npmVersionSchema.safeParse(
        await readJson(options.request, `${npmPath(build.name)}/${build.version}`),
      );
      if (!pkg.success || pkg.data.name !== build.name || pkg.data.version !== build.version) {
        throw new ToolError("unknownVersion");
      }
      if (!pkg.data.dist.tarball.startsWith(`${npmRegistry}/`)) {
        throw new ToolError("signatureInvalid");
      }
      if (!hasValidNpmSignature(pkg.data, options.signingKeys)) {
        throw new ToolError("signatureInvalid");
      }
      return {
        url: pkg.data.dist.tarball,
        sha512: Buffer.from(pkg.data.dist.integrity.slice("sha512-".length), "base64"),
      };
    },
  };
}

const rustTargets = {
  linux: { x64: "x86_64-unknown-linux-musl", arm64: "aarch64-unknown-linux-musl" },
  darwin: { x64: "x86_64-apple-darwin", arm64: "aarch64-apple-darwin" },
} as const;

/** Google publishes only the newest build per platform, with its SHA-512, and no release date. */
function antigravitySource(options: {
  request: Request;
  platform: ToolPlatform;
  manifestBase: string;
}): ToolSource {
  const platform = `${options.platform.os}_${options.platform.arch === "x64" ? "amd64" : "arm64"}`;
  const downloadPrefix = "https://storage.googleapis.com/antigravity-public/antigravity-cli/";

  async function manifest() {
    const parsed = antigravityManifestSchema.safeParse(
      await readJson(options.request, `${options.manifestBase}/manifests/${platform}.json`),
    );
    if (!parsed.success || !isAiToolVersion(parsed.data.version)) return null;
    return parsed.data;
  }

  return {
    provider: "antigravity",
    binary: "antigravity",
    smokeTests: [
      {
        args: ["--help"],
        tokens: ["--print", "--output-format", "--agent", "--disable-slash-commands", "models"],
      },
    ],

    async latest() {
      const current = await manifest();
      return current ? { version: current.version, publishedAt: null } : null;
    },

    async publishedAt() {
      return null;
    },

    async artifact(version) {
      const current = await manifest();
      // Older builds are not listed, so only the version the manifest names can be installed.
      if (!current || current.version !== version) throw new ToolError("unknownVersion");
      if (!current.url.startsWith(`${downloadPrefix}${version}-`)) {
        throw new ToolError("signatureInvalid");
      }
      return { url: current.url, sha512: Buffer.from(current.sha512, "hex") };
    },
  };
}

export const antigravityManifestBase =
  "https://antigravity-cli-auto-updater-974169037036.us-central1.run.app";

export function createToolSources(options: {
  platform: ToolPlatform;
  request?: Request;
  antigravityManifestBase?: string;
  npmSigningKeys?: Record<string, string>;
}): ToolSource[] {
  const request = options.request ?? fetch;
  const { os, arch } = options.platform;
  const target = rustTargets[os][arch];

  return [
    npmSource({
      provider: "claude",
      name: "@anthropic-ai/claude-code",
      build: (version) => ({ name: `@anthropic-ai/claude-code-${os}-${arch}`, version }),
      binary: "package/claude",
      smokeTests: [
        {
          args: ["--help"],
          tokens: [
            "--print",
            "--output-format",
            "--json-schema",
            "--tools",
            "--strict-mcp-config",
            "--setting-sources",
            "--no-session-persistence",
            "--append-system-prompt",
            "--include-partial-messages",
          ],
        },
      ],
      request,
      signingKeys: options.npmSigningKeys,
    }),
    npmSource({
      provider: "codex",
      name: "@openai/codex",
      build: (version) => ({ name: "@openai/codex", version: `${version}-${os}-${arch}` }),
      binary: `package/vendor/${target}/bin/codex`,
      smokeTests: [
        { args: ["--help"], tokens: ["app-server", "login", "exec"] },
        {
          args: ["exec", "--help"],
          tokens: [
            "--output-schema",
            "--sandbox",
            "--ephemeral",
            "--ignore-user-config",
            "--skip-git-repo-check",
            "--output-last-message",
          ],
        },
      ],
      request,
      signingKeys: options.npmSigningKeys,
    }),
    antigravitySource({
      request,
      platform: options.platform,
      manifestBase: options.antigravityManifestBase ?? antigravityManifestBase,
    }),
  ];
}
