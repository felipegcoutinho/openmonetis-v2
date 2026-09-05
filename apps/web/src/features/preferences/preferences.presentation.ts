import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import type { TransactionCreateDefaults } from "@/features/transactions/components/transaction-form.validation";
import { PreferencesApiError } from "./preferences.api";

export const automaticPreferenceValue = "automatic";

export function getTransactionPreferenceDefaults(
  preferences?: UserPreferencesOutput,
): TransactionCreateDefaults {
  if (!preferences) return {};

  return {
    paymentMethod: preferences.defaultPaymentMethod,
    accountId: preferences.defaultAccountId ?? undefined,
    cardId: preferences.defaultCardId ?? undefined,
  };
}

export function preferencesMutationErrorMessage(error: unknown) {
  if (
    error instanceof PreferencesApiError &&
    (error.code === "default_account_unavailable" || error.code === "default_card_unavailable")
  ) {
    return "A conta ou o cartão escolhido não está mais disponível.";
  }

  if (error instanceof PreferencesApiError && error.status === 401) {
    return "Sua sessão expirou. Entre novamente para continuar.";
  }

  return "Não foi possível salvar as preferências. Tente novamente.";
}
