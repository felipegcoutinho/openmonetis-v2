import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type {
  AiProviderLoginOutput,
  AiProviderOutput,
  AiProvidersOutput,
  UpdateAiProviderInput,
} from "@openmonetis/validators/ai-providers";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class AiProvidersApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "AiProvidersApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new AiProvidersApiError(message, code, status),
  });
}

export function getAiProviders(signal?: AbortSignal) {
  return request<AiProvidersOutput>("/ai-providers", { signal });
}

export function startAiProviderLogin(provider: AiProvider) {
  return request<AiProviderLoginOutput>(`/ai-providers/${provider}/logins`, {
    method: "POST",
    body: JSON.stringify({ acceptDataSharing: true }),
  });
}

export function getAiProviderLogin(provider: AiProvider, loginId: string, signal?: AbortSignal) {
  return request<AiProviderLoginOutput>(`/ai-providers/${provider}/logins/${loginId}`, {
    signal,
  });
}

export function submitAiProviderLoginCode(provider: AiProvider, loginId: string, code: string) {
  return request<AiProviderLoginOutput>(`/ai-providers/${provider}/logins/${loginId}/code`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export function updateAiProvider(provider: AiProvider, input: UpdateAiProviderInput) {
  return request<AiProviderOutput>(`/ai-providers/${provider}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function disconnectAiProvider(provider: AiProvider) {
  return request<AiProviderOutput>(`/ai-providers/${provider}`, { method: "DELETE" });
}
