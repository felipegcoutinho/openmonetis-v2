import { getAuthenticatorName } from "@better-auth/passkey";
import type { ChangePasswordInput } from "@openmonetis/validators/auth";
import type {
  DeleteSettingsAccountInput,
  DeleteSettingsAccountOutput,
  ResetSettingsInput,
  ResetSettingsOutput,
  SettingsSecurityOutput,
} from "@openmonetis/validators/settings";
import { ApiClientError, requestApi } from "@/lib/api-client";
import { authClient } from "@/lib/auth-client";

export class SettingsApiError extends ApiClientError {
  constructor(message: string, code?: string, status?: number) {
    super(message, code, status);
    this.name = "SettingsApiError";
  }
}

export type PasskeySummary = {
  id: string;
  name: string | null;
  authenticatorName: string | null;
  deviceType: string;
  backedUp: boolean;
  createdAt: Date | null;
};

function throwSettingsAuthError(error: {
  code?: string;
  message?: string;
  status?: number;
}): never {
  throw new SettingsApiError(
    error.message ?? "Authentication request failed",
    error.code,
    error.status,
  );
}

export async function listPasskeys(): Promise<PasskeySummary[]> {
  const result = await authClient.passkey.listUserPasskeys();
  if (result.error) throwSettingsAuthError(result.error);

  return (result.data ?? []).map((passkey) => ({
    id: passkey.id,
    name: passkey.name ?? null,
    authenticatorName: getAuthenticatorName(passkey.aaguid) ?? null,
    deviceType: passkey.deviceType,
    backedUp: passkey.backedUp,
    createdAt: passkey.createdAt ? new Date(passkey.createdAt) : null,
  }));
}

export async function addPasskey(name?: string) {
  const result = await authClient.passkey.addPasskey({ name });
  if (result.error) throwSettingsAuthError(result.error);
}

export async function renamePasskey(id: string, name: string) {
  const result = await authClient.passkey.updatePasskey({ id, name });
  if (result.error) throwSettingsAuthError(result.error);
}

export async function removePasskey(id: string) {
  const result = await authClient.passkey.deletePasskey({ id });
  if (result.error) throwSettingsAuthError(result.error);
}

export async function changeSettingsPassword(input: ChangePasswordInput) {
  const result = await authClient.changePassword({
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
    revokeOtherSessions: true,
  });
  if (result.error) throwSettingsAuthError(result.error);
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message, status }) => new SettingsApiError(message, code, status),
    useResponseMessage: true,
  });
}

export function resetSettings(input: ResetSettingsInput) {
  return request<ResetSettingsOutput>("/settings/reset", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getSettingsSecurity() {
  return request<SettingsSecurityOutput>("/settings/security", { method: "GET" });
}

export function deleteSettingsAccount(input: DeleteSettingsAccountInput) {
  return request<DeleteSettingsAccountOutput>("/settings/account", {
    method: "DELETE",
    body: JSON.stringify(input),
  });
}
