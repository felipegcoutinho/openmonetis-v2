import type {
  CreateDeviceTokenInput,
  CreatedDeviceTokenOutput,
  DeviceTokenOutput,
} from "@openmonetis/validators/device-tokens";
import { requestApi } from "@/lib/api-client";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, { errorMessage: "device_token_request_failed" });
}

export function getDeviceTokens() {
  return request<DeviceTokenOutput[]>("/device-tokens");
}

export function createDeviceToken(input: CreateDeviceTokenInput) {
  return request<CreatedDeviceTokenOutput>("/device-tokens", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function revokeDeviceToken(id: string) {
  return request<{ id: string }>(`/device-tokens/${id}`, { method: "DELETE" });
}
