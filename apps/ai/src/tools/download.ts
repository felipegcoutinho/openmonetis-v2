import { createHash, timingSafeEqual } from "node:crypto";
import { createWriteStream } from "node:fs";
import { chmod, lstat, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { runCommand } from "../utils/process";
import { type ToolArtifact, ToolError } from "./sources";

const downloadTimeoutMs = 15 * 60_000;
/** Native builds are a few hundred megabytes; anything far larger is not what was published. */
const maximumDownloadBytes = 1024 * 1024 * 1024;
const extractTimeoutMs = 5 * 60_000;

/** Streams the archive to `destination`, refusing it unless its SHA-512 matches the artifact. */
export async function downloadVerified(
  artifact: ToolArtifact,
  destination: string,
  request: typeof fetch = fetch,
) {
  let response: Response;
  try {
    response = await request(artifact.url, { signal: AbortSignal.timeout(downloadTimeoutMs) });
  } catch {
    throw new ToolError("downloadFailed");
  }
  if (!response.ok || !response.body) throw new ToolError("downloadFailed");

  const hash = createHash("sha512");
  let size = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      size += chunk.length;
      if (size > maximumDownloadBytes) {
        callback(new ToolError("downloadFailed"));
        return;
      }
      hash.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0]),
      measure,
      createWriteStream(destination, { mode: 0o600 }),
    );
  } catch (error) {
    throw error instanceof ToolError ? error : new ToolError("downloadFailed");
  }

  const digest = hash.digest();
  if (digest.length !== artifact.sha512.length || !timingSafeEqual(digest, artifact.sha512)) {
    throw new ToolError("integrityMismatch");
  }
}

/** Extracts with the system tar, which drops absolute and `..` member paths and owners. */
export async function extractArchive(archive: string, directory: string) {
  const result = await runCommand("tar", ["-xzf", archive, "-C", directory, "--no-same-owner"], {
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin" },
    timeoutMs: extractTimeoutMs,
  });
  if (result.exitCode !== 0) throw new ToolError("installFailed");
}

/**
 * Write access is removed from every installed file, so a CLI that tries to update itself (the
 * Antigravity CLI does, in the background) cannot replace a reviewed build.
 */
export async function makeReadOnly(target: string) {
  const info = await lstat(target);
  if (info.isSymbolicLink()) return;
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) await makeReadOnly(path.join(target, entry));
  }
  await chmod(target, info.mode & 0o555);
}

async function makeWritable(target: string) {
  const info = await lstat(target).catch(() => null);
  if (!info || info.isSymbolicLink()) return;
  await chmod(target, (info.mode & 0o777) | 0o200);
  if (info.isDirectory()) {
    for (const entry of await readdir(target)) await makeWritable(path.join(target, entry));
  }
}

/** Removes a read-only installation. */
export async function removeInstallation(target: string) {
  await makeWritable(target);
  await rm(target, { recursive: true, force: true });
}
