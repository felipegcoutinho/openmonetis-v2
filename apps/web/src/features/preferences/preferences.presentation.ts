import {
  type ApplicationTheme,
  type DarkPalette,
  darkPalettes,
  type LightPalette,
  lightPalettes,
  type MobileShortcutDestination,
  type StartPageDestination,
} from "@openmonetis/domain/preferences";
import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import type { Appearance } from "@/components/theme-provider";
import type { TransactionCreateDefaults } from "@/features/transactions/components/transaction-form.validation";
import { PreferencesApiError } from "./preferences.api";

export const automaticPreferenceValue = "automatic";

export const mobileShortcutLabels: Record<MobileShortcutDestination, string> = {
  accounts: "Contas",
  cards: "Cartões",
  budgets: "Orçamentos",
  goals: "Metas",
  people: "Pessoas",
  categories: "Categorias",
  notes: "Anotações",
  attachments: "Anexos",
  inbox: "Capturas",
};

export const startPageLabels: Record<StartPageDestination, string> = {
  dashboard: "Visão geral",
  transactions: "Lançamentos",
  accounts: "Contas",
  cards: "Cartões",
  budgets: "Orçamentos",
  inbox: "Caixa de entrada",
};

export const startPagePaths = {
  dashboard: "/dashboard",
  transactions: "/transactions",
  accounts: "/accounts",
  cards: "/cards",
  budgets: "/budgets",
  inbox: "/inbox",
} as const satisfies Record<StartPageDestination, string>;

export const paletteLabels: Record<LightPalette | DarkPalette, string> = {
  openmonetis: "OpenMonetis",
  absolutely: "Absolutely",
  catppuccin: "Catppuccin",
  everforest: "Everforest",
  flexoki: "Flexoki",
  github: "GitHub",
  githubDimmed: "GitHub",
  githubHighContrast: "GitHub",
  githubColorblind: "GitHub",
  githubLegacy: "GitHub",
  gotham: "Gotham",
  gruvbox: "Gruvbox",
  jellybeans: "Jellybeans",
  monokai: "Monokai",
  moonfly: "Moonfly",
  nord: "Nord",
  posterpole: "Posterpole",
  posterpoleGray: "Posterpole",
  rosePine: "Rosé Pine",
  terminal: "Terminal",
  tokyoNight: "Tokyo Night",
  tokyoNightStorm: "Tokyo Night",
  tokyoNightMoon: "Tokyo Night",
  vesper: "Vesper",
};

/** The name each palette's author gives to its version for the mode. */
export const lightPaletteVariantLabels: Record<LightPalette, string> = {
  openmonetis: "Padrão",
  absolutely: "Padrão",
  catppuccin: "Latte",
  everforest: "Light",
  flexoki: "Light",
  github: "Light",
  githubHighContrast: "Light High Contrast",
  githubColorblind: "Light Colorblind",
  githubLegacy: "Light Legacy",
  rosePine: "Dawn",
  tokyoNight: "Day",
};

export const darkPaletteVariantLabels: Record<DarkPalette, string> = {
  openmonetis: "Padrão",
  absolutely: "Padrão",
  catppuccin: "Mocha",
  everforest: "Dark",
  flexoki: "Dark",
  github: "Dark",
  githubDimmed: "Dark Dimmed",
  githubHighContrast: "Dark High Contrast",
  githubColorblind: "Dark Colorblind",
  githubLegacy: "Dark Legacy",
  gotham: "Padrão",
  gruvbox: "Dark",
  jellybeans: "Padrão",
  monokai: "Classic",
  moonfly: "Padrão",
  nord: "Polar Night",
  posterpole: "Padrão",
  posterpoleGray: "Gray",
  rosePine: "Moon",
  terminal: "Padrão",
  tokyoNight: "Night",
  tokyoNightStorm: "Storm",
  tokyoNightMoon: "Moon",
  vesper: "Padrão",
};

export const applicationThemeLabels: Record<ApplicationTheme, string> = {
  system: "Sistema",
  light: "Claro",
  dark: "Escuro",
};

/** Exists in both modes and is the palette built for low vision, offered when the device asks. */
export const highContrastPalette = "githubHighContrast" satisfies LightPalette & DarkPalette;

/** How a palette is named outside the picker: the family, plus the variant when it has one. */
export function getPaletteName(selection: PaletteSelection) {
  const variant =
    selection.mode === "light"
      ? lightPaletteVariantLabels[selection.palette]
      : darkPaletteVariantLabels[selection.palette];
  const family = paletteLabels[selection.palette];
  return variant === "Padrão" ? family : `${family} ${variant}`;
}

export type PaletteSelection =
  | { mode: "light"; palette: LightPalette }
  | { mode: "dark"; palette: DarkPalette };

/**
 * The other mode's version of a chosen palette: the same id when the family names both modes alike
 * (GitHub Colorblind, Catppuccin), otherwise the family's first palette in that mode (Tokyo Night
 * Storm pairs with Tokyo Night Day). `null` when the family has no version there or it is already
 * the other mode's palette.
 */
export function getPalettePair(
  selection: PaletteSelection,
  otherPalette: LightPalette | DarkPalette,
): PaletteSelection | null {
  const family = paletteLabels[selection.palette];
  const findPair = <Palette extends LightPalette | DarkPalette>(palettes: readonly Palette[]) =>
    palettes.find((palette) => palette === selection.palette) ??
    palettes.find((palette) => paletteLabels[palette] === family);

  if (selection.mode === "light") {
    const palette = findPair(darkPalettes);
    return palette && palette !== otherPalette ? { mode: "dark", palette } : null;
  }
  const palette = findPair(lightPalettes);
  return palette && palette !== otherPalette ? { mode: "light", palette } : null;
}

/** Sample figures drawn in a theme preview. Illustrative only, never the user's data. */
export const paletteSampleSummary = {
  title: "Resumo do mês",
  action: "Salvar",
  rows: [
    { label: "Receitas", value: "+ R$ 4.250,00", tone: "income" },
    { label: "Despesas", value: "− R$ 1.380,00", tone: "expense" },
  ],
} as const;

export function getAppearance(preferences: Appearance): Appearance {
  return {
    theme: preferences.theme,
    lightPalette: preferences.lightPalette,
    darkPalette: preferences.darkPalette,
  };
}

/** The preferences saved with the form; the appearance is saved on its own, as it changes. */
export function getFormPreferences(preferences: UserPreferencesOutput) {
  const {
    theme: _theme,
    lightPalette: _light,
    darkPalette: _dark,
    ...formPreferences
  } = preferences;
  return formPreferences;
}

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
