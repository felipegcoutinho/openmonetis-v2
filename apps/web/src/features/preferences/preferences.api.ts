import type {
  UpdateUserPreferencesInput,
  UserPreferencesOutput,
} from "@openmonetis/validators/preferences";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class PreferencesApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "PreferencesApiError";
  }
}

function request<T>(init?: RequestInit, path = "/preferences") {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new PreferencesApiError(message, code, status),
    useResponseMessage: true,
  });
}

export function getUserPreferences() {
  return request<UserPreferencesOutput>();
}

export function getDefaultUserPreferences() {
  return request<UserPreferencesOutput>(undefined, "/preferences/defaults");
}

export function updateUserPreferences(input: UpdateUserPreferencesInput) {
  return request<UserPreferencesOutput>({ method: "PATCH", body: JSON.stringify(input) });
}
