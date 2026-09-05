import type { MarkReleaseSeenOutput, ReleasesOutput } from "@openmonetis/validators/releases";
import { requestApi } from "@/lib/api-client";

export function getReleases() {
  return requestApi<ReleasesOutput>("/releases");
}

export function markReleaseSeen(version: string) {
  return requestApi<MarkReleaseSeenOutput>(`/releases/${encodeURIComponent(version)}`, {
    method: "PATCH",
    body: JSON.stringify({ seen: true }),
  });
}
