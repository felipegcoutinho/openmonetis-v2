import { queryOptions } from "@tanstack/react-query";
import { getReleases } from "./releases.api";

export const releaseKeys = {
  all: ["releases"] as const,
};

export function releasesQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: releaseKeys.all,
    queryFn: getReleases,
    enabled,
    staleTime: 15 * 60 * 1_000,
  });
}
