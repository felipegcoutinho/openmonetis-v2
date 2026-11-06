import { queryOptions } from "@tanstack/react-query";
import { getAiDataPreview, getAiDataSharing } from "./ai-data-sharing.api";

export const aiDataSharingKeys = {
  all: ["ai-data-sharing"] as const,
  previews: () => [...aiDataSharingKeys.all, "preview"] as const,
  preview: (period: string) => [...aiDataSharingKeys.previews(), period] as const,
};

export function aiDataSharingQueryOptions() {
  return queryOptions({
    queryKey: aiDataSharingKeys.all,
    queryFn: ({ signal }) => getAiDataSharing(signal),
  });
}

/** Never cached: the preview must show what would be sent now, not what was sent before. */
export function aiDataPreviewQueryOptions(period: string) {
  return queryOptions({
    queryKey: aiDataSharingKeys.preview(period),
    queryFn: ({ signal }) => getAiDataPreview(period, signal),
    gcTime: 0,
    staleTime: 0,
  });
}
