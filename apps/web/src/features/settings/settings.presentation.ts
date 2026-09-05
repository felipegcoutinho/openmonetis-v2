import { SettingsApiError } from "./settings.api";

export const settingsTabs = ["preferences", "security", "companion", "danger-zone"] as const;
export type SettingsTab = (typeof settingsTabs)[number];
type SettingsSearch = { tab?: SettingsTab };

export function validateSettingsSearch(search: Record<string, unknown>): SettingsSearch {
  return settingsTabs.includes(search.tab as SettingsTab) ? { tab: search.tab as SettingsTab } : {};
}

export function settingsMutationErrorMessage(error: unknown) {
  if (
    error instanceof SettingsApiError &&
    (error.code === "rate_limited" || error.status === 429)
  ) {
    return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  }

  if (error instanceof SettingsApiError && error.code === "SESSION_NOT_FRESH") {
    return "Por segurança, saia e entre novamente antes de gerenciar suas chaves de acesso.";
  }

  if (error instanceof SettingsApiError && error.status === 401) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  return "Não foi possível concluir a ação. Tente novamente.";
}

export function passwordMutationErrorMessage(error: unknown) {
  if (error instanceof SettingsApiError && error.code === "PASSWORD_UNCHANGED") {
    return "A nova senha deve ser diferente da atual.";
  }

  if (error instanceof SettingsApiError && error.code === "INVALID_PASSWORD") {
    return "A senha atual está incorreta.";
  }

  if (error instanceof SettingsApiError && error.code === "CREDENTIAL_ACCOUNT_NOT_FOUND") {
    return "Esta conta não possui uma senha cadastrada.";
  }

  if (error instanceof SettingsApiError && error.code === "SESSION_NOT_FRESH") {
    return "Por segurança, saia e entre novamente antes de trocar a senha.";
  }

  if (error instanceof SettingsApiError && error.status === 429) {
    return "Muitas tentativas. Aguarde um minuto e tente novamente.";
  }

  if (error instanceof SettingsApiError && error.status === 401) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  return "Não foi possível trocar a senha. Tente novamente.";
}
