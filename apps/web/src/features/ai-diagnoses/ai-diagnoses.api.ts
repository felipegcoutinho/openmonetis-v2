import type {
  AiDiagnosesOutput,
  AiDiagnosisOutput,
  CreateAiDiagnosisInput,
} from "@openmonetis/validators/ai-diagnoses";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class AiDiagnosesApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "AiDiagnosesApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new AiDiagnosesApiError(message, code, status),
  });
}

export function getAiDiagnoses(signal?: AbortSignal) {
  return request<AiDiagnosesOutput>("/ai-diagnoses", { signal });
}

export function getAiDiagnosis(id: string, signal?: AbortSignal) {
  return request<AiDiagnosisOutput>(`/ai-diagnoses/${id}`, { signal });
}

export function cancelAiDiagnosis(id: string) {
  return request<AiDiagnosisOutput>(`/ai-diagnoses/${id}/cancel`, { method: "POST" });
}

export function deleteAiDiagnosis(id: string) {
  return request<{ id: string }>(`/ai-diagnoses/${id}`, { method: "DELETE" });
}

export function createAiDiagnosis(input: CreateAiDiagnosisInput) {
  return request<AiDiagnosisOutput>("/ai-diagnoses", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
