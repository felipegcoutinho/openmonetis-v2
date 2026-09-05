import { type PaymentMethod, paymentMethods } from "./transactions";

export const applicationThemes = ["system", "light", "dark"] as const;
export const notificationDueSoonDayOptions = [1, 3, 5, 7] as const;
export const transactionPageSizeOptions = [20, 30, 50] as const;

export type ApplicationTheme = (typeof applicationThemes)[number];
export type NotificationDueSoonDays = (typeof notificationDueSoonDayOptions)[number];
export type TransactionPageSize = (typeof transactionPageSizeOptions)[number];

export type UserPreferences = {
  theme: ApplicationTheme;
  hideValuesOnStart: boolean;
  defaultPaymentMethod: PaymentMethod;
  defaultAccountId: string | null;
  defaultCardId: string | null;
  notificationDueSoonDays: NotificationDueSoonDays;
  transactionsPageSize: TransactionPageSize;
};

export type UserPreferencesRecord = {
  theme: string;
  hideValuesOnStart: boolean;
  defaultPaymentMethod: string;
  defaultAccountId: string | null;
  defaultCardId: string | null;
  notificationDueSoonDays: number;
  transactionsPageSize: number;
};

const applicationThemeSet = new Set<string>(applicationThemes);
const notificationDueSoonDaySet = new Set<number>(notificationDueSoonDayOptions);
const paymentMethodSet = new Set<string>(paymentMethods);
const transactionPageSizeSet = new Set<number>(transactionPageSizeOptions);

export function createDefaultUserPreferences(): UserPreferences {
  return {
    theme: "system",
    hideValuesOnStart: false,
    defaultPaymentMethod: "credit_card",
    defaultAccountId: null,
    defaultCardId: null,
    notificationDueSoonDays: 5,
    transactionsPageSize: 30,
  };
}

export function normalizeUserPreferences(
  preferences?: Partial<UserPreferencesRecord> | null,
): UserPreferences {
  const defaults = createDefaultUserPreferences();
  if (!preferences) return defaults;

  return {
    theme: applicationThemeSet.has(preferences.theme ?? "")
      ? (preferences.theme as ApplicationTheme)
      : defaults.theme,
    hideValuesOnStart:
      typeof preferences.hideValuesOnStart === "boolean"
        ? preferences.hideValuesOnStart
        : defaults.hideValuesOnStart,
    defaultPaymentMethod: paymentMethodSet.has(preferences.defaultPaymentMethod ?? "")
      ? (preferences.defaultPaymentMethod as PaymentMethod)
      : defaults.defaultPaymentMethod,
    defaultAccountId:
      typeof preferences.defaultAccountId === "string" ? preferences.defaultAccountId : null,
    defaultCardId: typeof preferences.defaultCardId === "string" ? preferences.defaultCardId : null,
    notificationDueSoonDays: notificationDueSoonDaySet.has(
      preferences.notificationDueSoonDays ?? Number.NaN,
    )
      ? (preferences.notificationDueSoonDays as NotificationDueSoonDays)
      : defaults.notificationDueSoonDays,
    transactionsPageSize: transactionPageSizeSet.has(preferences.transactionsPageSize ?? Number.NaN)
      ? (preferences.transactionsPageSize as TransactionPageSize)
      : defaults.transactionsPageSize,
  };
}
