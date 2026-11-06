import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type {
  ActivateAiToolInput,
  AiToolEventsOutput,
  AiToolJobOutput,
  AiToolOutput,
  AiToolsOutput,
  InstallAiToolInput,
} from "@openmonetis/validators/ai-tools";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class AiToolsApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "AiToolsApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new AiToolsApiError(message, code, status),
  });
}

export function getAiTools(signal?: AbortSignal) {
  return request<AiToolsOutput>("/ai-tools", { signal });
}

export function getAiToolEvents(signal?: AbortSignal) {
  return request<AiToolEventsOutput>("/ai-tools/events", { signal });
}

export function installAiTool(provider: AiProvider, input: InstallAiToolInput) {
  return request<AiToolJobOutput>(`/ai-tools/${provider}/installs`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function activateAiTool(provider: AiProvider, input: ActivateAiToolInput) {
  return request<AiToolOutput>(`/ai-tools/${provider}/active`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}
