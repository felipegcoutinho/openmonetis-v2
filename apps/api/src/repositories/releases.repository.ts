import { readFileSync } from "node:fs";
import { db, notificationStates } from "@openmonetis/db";
import {
  getReleaseNotificationKey,
  isSemanticVersion,
  type ReleaseSectionType,
} from "@openmonetis/domain/releases";
import { and, eq } from "drizzle-orm";
import type {
  PublishedRelease,
  ReleaseCatalogEntry,
  ReleasesRepository,
} from "../services/releases.service";

const sectionTypesByHeading: Record<string, ReleaseSectionType> = {
  Adicionado: "added",
  Added: "added",
  Alterado: "changed",
  Changed: "changed",
  Descontinuado: "deprecated",
  Deprecated: "deprecated",
  Removido: "removed",
  Removed: "removed",
  Corrigido: "fixed",
  Fixed: "fixed",
  Segurança: "security",
  Security: "security",
};

const apiPackageUrl = new URL("../../package.json", import.meta.url);
const repositorySlug = getRepositorySlug(process.env.RELEASE_REPOSITORY);
const releasesUrl = `https://github.com/${repositorySlug}/releases`;
const currentVersion = readCurrentVersion();
let catalogCache: ReleaseCatalogEntry[] | null = null;
let publishedReleaseCache: { expiresAt: number; value: PublishedRelease | null } | undefined;

export const releasesRepository: ReleasesRepository = {
  currentVersion,
  releasesUrl,

  async listCatalog() {
    catalogCache ??= parseChangelog(readChangelog());
    return catalogCache;
  },

  async findLatestPublished() {
    const now = Date.now();
    if (publishedReleaseCache && publishedReleaseCache.expiresAt > now) {
      return publishedReleaseCache.value;
    }

    const value = await fetchLatestPublishedRelease();
    publishedReleaseCache = {
      expiresAt: now + (value ? 6 * 60 * 60 * 1_000 : 15 * 60 * 1_000),
      value,
    };
    return value;
  },

  async hasSeen(userId, version) {
    const [state] = await db
      .select({ readAt: notificationStates.readAt })
      .from(notificationStates)
      .where(
        and(
          eq(notificationStates.userId, userId),
          eq(notificationStates.notificationKey, getReleaseNotificationKey(version)),
        ),
      )
      .limit(1);

    return state?.readAt !== null && state?.readAt !== undefined;
  },

  async markSeen(userId, version, seenAt) {
    const notificationKey = getReleaseNotificationKey(version);
    await db
      .insert(notificationStates)
      .values({
        userId,
        notificationKey,
        fingerprint: version,
        readAt: new Date(seenAt),
        archivedAt: null,
      })
      .onConflictDoUpdate({
        target: [notificationStates.userId, notificationStates.notificationKey],
        set: {
          fingerprint: version,
          readAt: new Date(seenAt),
          archivedAt: null,
          updatedAt: new Date(),
        },
      });
  },
};

function readCurrentVersion() {
  const packageContents = readFileSync(apiPackageUrl, "utf8");
  const packageVersion = (JSON.parse(packageContents) as { version?: unknown }).version;
  if (typeof packageVersion !== "string" || !isSemanticVersion(packageVersion)) {
    throw new Error("The API package version must be a stable semantic version");
  }
  return packageVersion;
}

function readChangelog() {
  const changelogUrl = new URL("../../../../CHANGELOG.md", import.meta.url);
  return readFileSync(changelogUrl, "utf8");
}

function parseChangelog(contents: string): ReleaseCatalogEntry[] {
  const releases: ReleaseCatalogEntry[] = [];
  let current: ReleaseCatalogEntry | null = null;
  let currentSection: ReleaseCatalogEntry["sections"][number] | null = null;
  let summaryLines: string[] = [];

  function finishSection() {
    if (current && currentSection && currentSection.items.length > 0) {
      current.sections.push(currentSection);
    }
    currentSection = null;
  }

  function finishRelease() {
    if (!current) return;
    finishSection();
    current.summary = summaryLines.join(" ").trim();
    if (!current.summary) throw new Error(`Release ${current.version} must include a summary`);
    releases.push(current);
    current = null;
    summaryLines = [];
  }

  for (const line of contents.split(/\r?\n/)) {
    const releaseMatch =
      /^## \[((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))\] - (\d{4}-\d{2}-\d{2})$/.exec(line);
    if (releaseMatch) {
      finishRelease();
      current = {
        version: releaseMatch[1] as string,
        date: releaseMatch[2] as string,
        summary: "",
        sections: [],
      };
      continue;
    }

    if (!current) continue;

    const sectionMatch = /^### (.+)$/.exec(line);
    if (sectionMatch) {
      finishSection();
      const type = sectionTypesByHeading[sectionMatch[1] as string];
      currentSection = type ? { type, items: [] } : null;
      continue;
    }

    const itemMatch = /^- (.+)$/.exec(line);
    if (itemMatch && currentSection) {
      currentSection.items.push(itemMatch[1] as string);
      continue;
    }

    if (!currentSection && line.trim()) summaryLines.push(line.trim());
  }

  finishRelease();
  return releases;
}

async function fetchLatestPublishedRelease(): Promise<PublishedRelease | null> {
  try {
    const response = await fetch(`${releasesUrl}/latest`, {
      redirect: "manual",
      signal: AbortSignal.timeout(3_000),
    });
    const location = response.headers.get("location");
    if (!location) return null;

    const releaseUrl = new URL(location, releasesUrl);
    if (releaseUrl.hostname !== "github.com") return null;
    const expectedPathPrefix = `/${repositorySlug}/releases/tag/`.toLowerCase();
    if (!releaseUrl.pathname.toLowerCase().startsWith(expectedPathPrefix)) return null;
    const match = /\/releases\/tag\/v?([^/]+)$/.exec(releaseUrl.pathname);
    const version = match?.[1];
    if (!version || !isSemanticVersion(version)) return null;

    return {
      version,
      url: `${releasesUrl}/tag/v${version}`,
    };
  } catch {
    return null;
  }
}

function getRepositorySlug(value: string | undefined) {
  const fallback = "felipegcoutinho/openmonetis-v2";
  if (!value) return fallback;
  return /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value) ? value : fallback;
}

export const applicationVersion = currentVersion;
