import { type PaymentMethod, paymentMethods } from "./transactions";

export const applicationThemes = ["system", "light", "dark"] as const;
/**
 * Colour palettes, chosen separately for each mode: the light one applies while the app is light
 * and the dark one while it is dark. Some palettes only exist in one mode.
 */
export const lightPalettes = [
  "openmonetis",
  "absolutely",
  "catppuccin",
  "everforest",
  "flexoki",
  "github",
  "githubHighContrast",
  "githubColorblind",
  "githubLegacy",
  "rosePine",
  "tokyoNight",
] as const;
export const darkPalettes = [
  "openmonetis",
  "absolutely",
  "catppuccin",
  "everforest",
  "flexoki",
  "github",
  "githubDimmed",
  "githubHighContrast",
  "githubColorblind",
  "githubLegacy",
  "gotham",
  "gruvbox",
  "jellybeans",
  "monokai",
  "moonfly",
  "nord",
  "posterpole",
  "posterpoleGray",
  "rosePine",
  "terminal",
  "tokyoNight",
  "tokyoNightStorm",
  "tokyoNightMoon",
  "vesper",
] as const;
export const notificationDueSoonDayOptions = [1, 3, 5, 7] as const;
export const transactionPageSizeOptions = [20, 30, 50] as const;
export const mobileShortcutDestinations = [
  "accounts",
  "cards",
  "budgets",
  "goals",
  "people",
  "categories",
  "notes",
  "attachments",
  "inbox",
] as const;
export const startPageDestinations = [
  "dashboard",
  "transactions",
  "accounts",
  "cards",
  "budgets",
  "inbox",
] as const;

export type ApplicationTheme = (typeof applicationThemes)[number];
export type LightPalette = (typeof lightPalettes)[number];
export type DarkPalette = (typeof darkPalettes)[number];
export type NotificationDueSoonDays = (typeof notificationDueSoonDayOptions)[number];
export type TransactionPageSize = (typeof transactionPageSizeOptions)[number];
export type MobileShortcutDestination = (typeof mobileShortcutDestinations)[number];
export type StartPageDestination = (typeof startPageDestinations)[number];

export type UserPreferences = {
  theme: ApplicationTheme;
  lightPalette: LightPalette;
  darkPalette: DarkPalette;
  hideValuesOnStart: boolean;
  defaultPaymentMethod: PaymentMethod;
  defaultAccountId: string | null;
  defaultCardId: string | null;
  notificationDueSoonDays: NotificationDueSoonDays;
  transactionsPageSize: TransactionPageSize;
  mobileShortcut: MobileShortcutDestination;
  startPage: StartPageDestination;
};

export type UserPreferencesRecord = {
  theme: string;
  lightPalette: string;
  darkPalette: string;
  hideValuesOnStart: boolean;
  defaultPaymentMethod: string;
  defaultAccountId: string | null;
  defaultCardId: string | null;
  notificationDueSoonDays: number;
  transactionsPageSize: number;
  mobileShortcut: string;
  startPage: string;
};

const applicationThemeSet = new Set<string>(applicationThemes);
const lightPaletteSet = new Set<string>(lightPalettes);
const darkPaletteSet = new Set<string>(darkPalettes);
const notificationDueSoonDaySet = new Set<number>(notificationDueSoonDayOptions);
const paymentMethodSet = new Set<string>(paymentMethods);
const transactionPageSizeSet = new Set<number>(transactionPageSizeOptions);
const mobileShortcutDestinationSet = new Set<string>(mobileShortcutDestinations);
const startPageDestinationSet = new Set<string>(startPageDestinations);

export function createDefaultUserPreferences(): UserPreferences {
  return {
    theme: "system",
    lightPalette: "openmonetis",
    darkPalette: "openmonetis",
    hideValuesOnStart: false,
    defaultPaymentMethod: "credit_card",
    defaultAccountId: null,
    defaultCardId: null,
    notificationDueSoonDays: 5,
    transactionsPageSize: 30,
    mobileShortcut: "accounts",
    startPage: "dashboard",
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
    lightPalette: lightPaletteSet.has(preferences.lightPalette ?? "")
      ? (preferences.lightPalette as LightPalette)
      : defaults.lightPalette,
    darkPalette: darkPaletteSet.has(preferences.darkPalette ?? "")
      ? (preferences.darkPalette as DarkPalette)
      : defaults.darkPalette,
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
    mobileShortcut: mobileShortcutDestinationSet.has(preferences.mobileShortcut ?? "")
      ? (preferences.mobileShortcut as MobileShortcutDestination)
      : defaults.mobileShortcut,
    startPage: startPageDestinationSet.has(preferences.startPage ?? "")
      ? (preferences.startPage as StartPageDestination)
      : defaults.startPage,
  };
}
