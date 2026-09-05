import type { ReleasesOutput } from "@openmonetis/validators/releases";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { markReleaseSeen } from "./releases.api";
import { releaseKeys } from "./releases.queries";

export function useMarkReleaseSeenMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markReleaseSeen,
    onSuccess: (result) => {
      queryClient.setQueryData<ReleasesOutput>(releaseKeys.all, (current) =>
        current && current.currentVersion === result.version
          ? { ...current, hasUnseenCurrentRelease: false }
          : current,
      );
    },
  });
}
