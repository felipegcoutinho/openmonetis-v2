import type {
  AiDataHistoryDeletedOutput,
  AiDataPreviewOutput,
  AiDataSharingOutput,
  UpdateAiDataRetentionInput,
  UpdateAiDataSharingInput,
} from "@openmonetis/validators/ai-data-sharing";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class AiDataSharingApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "AiDataSharingApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new AiDataSharingApiError(message, code, status),
  });
}

export function getAiDataSharing(signal?: AbortSignal) {
  return request<AiDataSharingOutput>("/ai-data-sharing", { signal });
}

export function updateAiDataSharing(input: UpdateAiDataSharingInput) {
  return request<AiDataSharingOutput>("/ai-data-sharing", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function updateAiDataRetention(input: UpdateAiDataRetentionInput) {
  return request<AiDataSharingOutput>("/ai-data-sharing/retention", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteAiDataHistory() {
  return request<AiDataHistoryDeletedOutput>("/ai-data-sharing/history", { method: "DELETE" });
}

export function getAiDataPreview(period: string, signal?: AbortSignal) {
  return request<AiDataPreviewOutput>(
    `/ai-data-sharing/preview?${new URLSearchParams({ period })}`,
    { signal },
  );
}
