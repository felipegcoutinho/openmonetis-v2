export const releaseSectionTypes = [
  "added",
  "changed",
  "deprecated",
  "removed",
  "fixed",
  "security",
] as const;

export type ReleaseSectionType = (typeof releaseSectionTypes)[number];

const semanticVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function isSemanticVersion(value: string): boolean {
  return semanticVersionPattern.test(value);
}

export function compareSemanticVersions(first: string, second: string): number {
  const firstParts = parseSemanticVersion(first);
  const secondParts = parseSemanticVersion(second);

  for (let index = 0; index < firstParts.length; index += 1) {
    const difference = (firstParts[index] ?? 0) - (secondParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }

  return 0;
}

export function getReleaseNotificationKey(version: string): string {
  if (!isSemanticVersion(version)) throw new Error("Invalid semantic version");
  return `release:${version}`;
}

function parseSemanticVersion(version: string): [number, number, number] {
  const match = semanticVersionPattern.exec(version);
  if (!match) throw new Error("Invalid semantic version");

  return [Number(match[1]), Number(match[2]), Number(match[3])];
}
