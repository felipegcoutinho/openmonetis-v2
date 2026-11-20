import {
  type ApplicationTheme,
  applicationThemes,
  darkPalettes,
  lightPalettes,
} from "@openmonetis/domain/preferences";
import { Contrast, Monitor, Moon, Sun } from "lucide-react";
import { type ReactNode, useState } from "react";
import { SettingsSection } from "@/components/settings-panel";
import { type ResolvedMode, useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import {
  applicationThemeLabels,
  darkPaletteVariantLabels,
  getPaletteName,
  getPalettePair,
  highContrastPalette,
  lightPaletteVariantLabels,
  type PaletteSelection,
} from "../preferences.presentation";
import { useSaveAppearance } from "../useSaveAppearance";
import { PaletteSwatch } from "./palette-swatch";
import { PreferencesPalettePicker } from "./preferences-palette-picker";

/**
 * Mode and theme of each mode. Unlike the rest of Preferences, every change here is saved at
 * once, as in the header menu and the search, so leaving the page never loses a theme.
 */
export function PreferencesAppearanceSection({ disabled }: { disabled: boolean }) {
  const { appearance, mode } = useTheme();
  const { saveAppearance } = useSaveAppearance();
  const [pair, setPair] = useState<PaletteSelection | null>(null);

  return (
    <SettingsSection
      description="Escolha o modo e o tema de cada um. As mudanças são salvas na hora."
      icon={Sun}
      title="Aparência"
    >
      <ModeControl
        disabled={disabled}
        mode={mode}
        onChange={(theme) => saveAppearance({ theme })}
        value={appearance.theme}
      />
      <div className="mt-6 grid gap-6 border-border border-t pt-5 sm:grid-cols-2 sm:gap-4">
        <PreferencesPalettePicker
          active={mode === "light"}
          description="Usado enquanto o modo claro estiver ativo."
          disabled={disabled}
          label="Tema claro"
          mode="light"
          onChange={(lightPalette) => {
            saveAppearance({ lightPalette });
            setPair(
              getPalettePair({ mode: "light", palette: lightPalette }, appearance.darkPalette),
            );
          }}
          palettes={lightPalettes}
          value={appearance.lightPalette}
          variantLabels={lightPaletteVariantLabels}
        />
        <PreferencesPalettePicker
          active={mode === "dark"}
          description="Usado enquanto o modo escuro estiver ativo."
          disabled={disabled}
          label="Tema escuro"
          mode="dark"
          onChange={(darkPalette) => {
            saveAppearance({ darkPalette });
            setPair(
              getPalettePair({ mode: "dark", palette: darkPalette }, appearance.lightPalette),
            );
          }}
          palettes={darkPalettes}
          value={appearance.darkPalette}
          variantLabels={darkPaletteVariantLabels}
        />
      </div>
      {pair ? (
        <Suggestion
          acceptLabel="Usar"
          disabled={disabled}
          icon={<PaletteSwatch palette={`${pair.palette}-${pair.mode}`} />}
          onAccept={() => {
            saveAppearance(
              pair.mode === "light"
                ? { lightPalette: pair.palette }
                : { darkPalette: pair.palette },
            );
            setPair(null);
          }}
          onDismiss={() => setPair(null)}
        >
          Usar {getPaletteName(pair)} também no tema {pair.mode === "dark" ? "escuro" : "claro"}?
        </Suggestion>
      ) : null}
      <HighContrastSuggestion
        active={
          appearance.lightPalette === highContrastPalette &&
          appearance.darkPalette === highContrastPalette
        }
        disabled={disabled}
        onApply={() => {
          saveAppearance({ lightPalette: highContrastPalette, darkPalette: highContrastPalette });
          setPair(null);
        }}
      />
    </SettingsSection>
  );
}

const modeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} satisfies Record<ApplicationTheme, typeof Sun>;

const modeDescriptions = {
  system: (mode: ResolvedMode) =>
    `Segue o seu dispositivo, agora no modo ${mode === "dark" ? "escuro" : "claro"}.`,
  light: () => "Sempre claro, mesmo com o dispositivo no modo escuro.",
  dark: () => "Sempre escuro, mesmo com o dispositivo no modo claro.",
} satisfies Record<ApplicationTheme, (mode: ResolvedMode) => string>;

/**
 * A one-line segmented control. The track is 10px round with 4px padding, so each segment takes
 * the concentric 6px; segments grow to 44px on touch screens.
 */
function ModeControl({
  value,
  mode,
  disabled,
  onChange,
}: {
  value: ApplicationTheme;
  mode: ResolvedMode;
  disabled: boolean;
  onChange: (theme: ApplicationTheme) => void;
}) {
  return (
    <fieldset disabled={disabled}>
      <legend className="sr-only">Modo do aplicativo</legend>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-foreground/6 p-1">
        {applicationThemes.map((theme) => {
          const Icon = modeIcons[theme];
          const selected = value === theme;
          return (
            <button
              aria-pressed={selected}
              className={cn(
                "flex h-11 items-center justify-center gap-2 rounded-sm font-medium text-muted-foreground text-sm transition-[background-color,color,box-shadow,scale] duration-150 ease-out hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.96] disabled:pointer-events-none disabled:opacity-50 sm:h-9",
                selected && "bg-background text-foreground shadow-sm",
              )}
              key={theme}
              onClick={() => onChange(theme)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-4" />
              {applicationThemeLabels[theme]}
            </button>
          );
        })}
      </div>
      <p aria-live="polite" className="mt-2 text-muted-foreground text-xs">
        {modeDescriptions[value](mode)}
      </p>
    </fieldset>
  );
}

function Suggestion({
  icon,
  children,
  acceptLabel,
  disabled,
  onAccept,
  onDismiss,
}: {
  icon: ReactNode;
  children: ReactNode;
  acceptLabel: string;
  disabled: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/50 p-3 sm:flex-row sm:items-center">
      <span className="hidden shrink-0 sm:flex">{icon}</span>
      <p className="min-w-0 flex-1 text-pretty text-sm">{children}</p>
      <div className="flex shrink-0 gap-2">
        <Button disabled={disabled} onClick={onDismiss} size="sm" type="button" variant="ghost">
          Agora não
        </Button>
        <Button disabled={disabled} onClick={onAccept} size="sm" type="button" variant="outline">
          {acceptLabel}
        </Button>
      </div>
    </div>
  );
}

const contrastSuggestionDismissedKey = "openmonetis-contrast-suggestion-dismissed";

function readContrastSuggestionDismissed() {
  try {
    return localStorage.getItem(contrastSuggestionDismissedKey) === "true";
  } catch {
    return false;
  }
}

/**
 * Offered only when the device asks for more contrast and the high-contrast palette is not already
 * chosen for both modes.
 */
function HighContrastSuggestion({
  active,
  disabled,
  onApply,
}: {
  active: boolean;
  disabled: boolean;
  onApply: () => void;
}) {
  const prefersMoreContrast = useMediaQuery("(prefers-contrast: more)");
  // Read only on the client: the server and hydration pass never show the suggestion.
  const [dismissed, setDismissed] = useState(() =>
    typeof window === "undefined" ? false : readContrastSuggestionDismissed(),
  );

  if (!prefersMoreContrast || active || dismissed) return null;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(contrastSuggestionDismissedKey, "true");
    } catch {
      // Without storage the suggestion simply returns on the next visit.
    }
  }

  return (
    <Suggestion
      acceptLabel="Usar"
      disabled={disabled}
      icon={<Contrast aria-hidden="true" className="size-4 text-muted-foreground" />}
      onAccept={onApply}
      onDismiss={dismiss}
    >
      Seu dispositivo pede mais contraste. Quer usar o GitHub High Contrast nos dois modos?
    </Suggestion>
  );
}
