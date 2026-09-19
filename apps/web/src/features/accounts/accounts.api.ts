import type {
  AccountBalanceAdjustmentOutput,
  AccountBalanceAdjustmentPreview,
  AccountOutput,
  AddAccountYieldInput,
  AdjustAccountBalanceInput,
  CreateAccountInput,
  ReplaceAccountInput,
  UpdateAccountInput,
} from "@openmonetis/validators/accounts";
import { ApiClientError, requestApi } from "@/lib/api-client";

export class AccountsApiError extends ApiClientError {
  constructor(message: string, code?: string) {
    super(message, code);
    this.name = "AccountsApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestApi<T>(path, init, {
    errorFactory: ({ code, message }) => new AccountsApiError(message, code),
    useResponseMessage: true,
  });
}

export function getAccounts(period: string) {
  return request<AccountOutput[]>(`/accounts?period=${encodeURIComponent(period)}`);
}

export function getAccount(id: string, period: string) {
  return request<AccountOutput>(`/accounts/${id}?period=${encodeURIComponent(period)}`);
}

export function createAccount(input: CreateAccountInput) {
  return request<AccountOutput>("/accounts", { method: "POST", body: JSON.stringify(input) });
}

export function replaceAccount(id: string, input: ReplaceAccountInput) {
  return request<AccountOutput>(`/accounts/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function updateAccount(id: string, input: UpdateAccountInput) {
  return request<AccountOutput>(`/accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteAccount(id: string) {
  return request<{ id: string }>(`/accounts/${id}`, { method: "DELETE" });
}

export function adjustAccountBalance(id: string, input: AdjustAccountBalanceInput) {
  return request<AccountBalanceAdjustmentOutput>(`/accounts/${id}/balance-adjustments`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function addAccountYield(id: string, input: AddAccountYieldInput) {
  return request<AccountOutput>(`/accounts/${id}/yields`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function previewAccountBalanceAdjustment(id: string, input: AdjustAccountBalanceInput) {
  return request<AccountBalanceAdjustmentPreview>(
    `/accounts/${encodeURIComponent(id)}/balance-adjustments/preview`,
    { method: "POST", body: JSON.stringify(input) },
  );
}
