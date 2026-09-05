import type { ApiFailure, ApiSuccess } from "@openmonetis/shared/api";

const apiUrl = "/api-proxy";

type ApiErrorDetails = {
  code?: string;
  message: string;
  status: number;
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function requestApi<T>(
  path: string,
  init?: RequestInit,
  options?: {
    errorFactory?: (details: ApiErrorDetails) => Error;
    errorMessage?: string;
    useResponseMessage?: boolean;
  },
): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as ApiSuccess<T> | ApiFailure;

  if (!response.ok || payload.error) {
    const responseMessage = "message" in payload ? payload.message : undefined;
    const details: ApiErrorDetails = {
      code: "code" in payload ? payload.code : undefined,
      message:
        options?.useResponseMessage && responseMessage
          ? responseMessage
          : (options?.errorMessage ?? "Request failed"),
      status: response.status,
    };
    throw (
      options?.errorFactory?.(details) ??
      new ApiClientError(details.message, details.code, details.status)
    );
  }

  return payload.data;
}
