/**
 * The vendor CLIs the AI service runs. The image ships one reviewed version of each; the
 * installation admin may install newer published releases into the tools volume.
 */

/** A release must be public this long before it can be installed, so bad releases get pulled. */
export const aiToolMinimumReleaseAgeDays = 3;

/** Only stable releases: no pre-release or build suffix ever reaches a path or a CLI. */
export const aiToolVersionPattern = /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,7})$/;

export const aiToolEventActions = ["install", "activate", "restoreBundled"] as const;
export type AiToolEventAction = (typeof aiToolEventActions)[number];

export const aiToolEventStatuses = ["pending", "completed", "failed"] as const;
export type AiToolEventStatus = (typeof aiToolEventStatuses)[number];

export const aiToolInstallSteps = ["download", "verify", "test", "activate"] as const;
export type AiToolInstallStep = (typeof aiToolInstallSteps)[number];

export const aiToolFailureCodes = [
  "tooRecent",
  "notNewer",
  "unknownVersion",
  "downloadFailed",
  "integrityMismatch",
  "signatureInvalid",
  "smokeTestFailed",
  "canaryFailed",
  "busy",
  "installFailed",
] as const;
export type AiToolFailureCode = (typeof aiToolFailureCodes)[number];

export function isAiToolVersion(value: string) {
  return aiToolVersionPattern.test(value);
}

/** Negative when `left` is older than `right`. Both must be stable versions. */
export function compareAiToolVersions(left: string, right: string) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

/** When a release seen or published at `releasedAt` may be installed. */
export function aiToolReleaseEligibleAt(releasedAt: Date) {
  return new Date(releasedAt.getTime() + aiToolMinimumReleaseAgeDays * 24 * 60 * 60 * 1000);
}

export function isAiToolReleaseEligible(releasedAt: Date, now: Date) {
  return aiToolReleaseEligibleAt(releasedAt).getTime() <= now.getTime();
}

/**
 * Why `candidate` cannot replace `current` (the active version, or the image's when none is
 * installed), or null when it can.
 */
export function aiToolUpdateBlocker(input: {
  candidate: string;
  current: string | null;
  releasedAt: Date;
  now: Date;
}): Extract<AiToolFailureCode, "notNewer" | "tooRecent" | "unknownVersion"> | null {
  if (!isAiToolVersion(input.candidate)) return "unknownVersion";
  if (input.current && compareAiToolVersions(input.candidate, input.current) <= 0) {
    return "notNewer";
  }
  if (!isAiToolReleaseEligible(input.releasedAt, input.now)) return "tooRecent";
  return null;
}

/**
 * Installed versions that may be deleted: everything but the active and previous ones, any version
 * not newer than the image's (the image already provides it), and never one a run is using.
 */
export function aiToolVersionsToRemove(input: {
  installed: readonly string[];
  active: string | null;
  previous: string | null;
  bundled: string | null;
  inUse: readonly string[];
}) {
  const keep = new Set([input.active, input.previous].filter((value) => value !== null));
  return input.installed.filter((version) => {
    if (input.inUse.includes(version)) return false;
    if (version === input.active) return false;
    if (input.bundled && compareAiToolVersions(version, input.bundled) <= 0) return true;
    return !keep.has(version);
  });
}
