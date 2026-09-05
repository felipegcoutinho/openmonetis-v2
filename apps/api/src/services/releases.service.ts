import { compareSemanticVersions, type ReleaseSectionType } from "@openmonetis/domain/releases";
import type {
  MarkReleaseSeenInput,
  MarkReleaseSeenOutput,
  ReleasesOutput,
} from "@openmonetis/validators/releases";
import { badRequest, notFound } from "../utils/errors";

export type ReleaseCatalogEntry = {
  version: string;
  date: string;
  summary: string;
  sections: Array<{ type: ReleaseSectionType; items: string[] }>;
};

export type PublishedRelease = {
  version: string;
  url: string;
};

export type ReleasesRepository = {
  currentVersion: string;
  releasesUrl: string;
  listCatalog(): Promise<ReleaseCatalogEntry[]>;
  findLatestPublished(): Promise<PublishedRelease | null>;
  hasSeen(userId: string, version: string): Promise<boolean>;
  markSeen(userId: string, version: string, seenAt: string): Promise<void>;
};

export function createReleasesService(
  repository: ReleasesRepository,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date());

  async function list(userId: string): Promise<ReleasesOutput> {
    const catalog = await repository.listCatalog();
    const currentRelease = catalog.find((release) => release.version === repository.currentVersion);
    if (!currentRelease) {
      throw new Error(`Current version ${repository.currentVersion} is missing from CHANGELOG.md`);
    }

    const [latestPublished, hasSeenCurrentRelease] = await Promise.all([
      repository.findLatestPublished(),
      repository.hasSeen(userId, repository.currentVersion),
    ]);
    const releases = [...catalog]
      .sort((first, second) => compareSemanticVersions(second.version, first.version))
      .map((release) => ({
        ...release,
        isCurrent: release.version === repository.currentVersion,
      }));

    return {
      currentVersion: repository.currentVersion,
      latestVersion: latestPublished?.version ?? null,
      updateAvailable: latestPublished
        ? compareSemanticVersions(latestPublished.version, repository.currentVersion) > 0
        : false,
      hasUnseenCurrentRelease: !hasSeenCurrentRelease,
      releasesUrl: repository.releasesUrl,
      latestReleaseUrl: latestPublished?.url ?? null,
      releases,
    };
  }

  return {
    list,

    async markSeen(
      version: string,
      input: MarkReleaseSeenInput,
      userId: string,
    ): Promise<MarkReleaseSeenOutput> {
      if (!input.seen) throw badRequest("Release must be marked as seen", "invalid_release_state");
      if (version !== repository.currentVersion) {
        throw badRequest(
          "Only the current release can be marked as seen",
          "release_is_not_current",
        );
      }

      const catalog = await repository.listCatalog();
      if (!catalog.some((release) => release.version === version)) {
        throw notFound("Release not found", "release_not_found");
      }

      await repository.markSeen(userId, version, now().toISOString());
      return { version, hasUnseenCurrentRelease: false };
    },
  };
}

export type ReleasesService = ReturnType<typeof createReleasesService>;
