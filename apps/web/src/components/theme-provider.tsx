import {
  type ApplicationTheme,
  applicationThemes,
  type DarkPalette,
  darkPalettes,
  type LightPalette,
  lightPalettes,
} from "@openmonetis/domain/preferences";
import { ScriptOnce } from "@tanstack/react-router";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { prefersReducedMotion } from "@/lib/pwa";

/** What the app looks like: the mode, and the palette used in each mode. */
export type Appearance = {
  theme: ApplicationTheme;
  lightPalette: LightPalette;
  darkPalette: DarkPalette;
};

export type ResolvedMode = "light" | "dark";

type ThemeProviderProps = {
  children: ReactNode;
};

type ThemeProviderState = {
  appearance: Appearance;
  /** The mode on screen now: the chosen one, or the device's when following the system. */
  mode: ResolvedMode;
  setAppearance: (appearance: Partial<Appearance>) => void;
};

const ThemeProviderContext = createContext<ThemeProviderState | undefined>(undefined);

const defaultAppearance: Appearance = {
  theme: "system",
  lightPalette: "openmonetis",
  darkPalette: "openmonetis",
};

const storageKeys = {
  theme: "openmonetis-theme",
  lightPalette: "openmonetis-light-palette",
  darkPalette: "openmonetis-dark-palette",
} as const satisfies Record<keyof Appearance, string>;

/* The system bars take the canvas colour of each palette, so the app reads as one surface. */
const browserThemeColors = {
  light: {
    openmonetis: "#f6f4f1",
    absolutely: "#faf9f5",
    catppuccin: "#eff1f5",
    everforest: "#fdf6e3",
    flexoki: "#fffcf0",
    github: "#f6f8fa",
    githubHighContrast: "#ffffff",
    githubColorblind: "#f6f8fa",
    githubLegacy: "#f6f8fa",
    rosePine: "#faf4ed",
    tokyoNight: "#e1e2e7",
  },
  dark: {
    openmonetis: "#1b1917",
    absolutely: "#262624",
    catppuccin: "#1e1e2e",
    everforest: "#2d353b",
    flexoki: "#100f0f",
    github: "#010409",
    githubDimmed: "#1c2128",
    githubHighContrast: "#010409",
    githubColorblind: "#010409",
    githubLegacy: "#1f2428",
    gotham: "#0c1014",
    gruvbox: "#282828",
    jellybeans: "#121212",
    monokai: "#272822",
    moonfly: "#080808",
    nord: "#2e3440",
    posterpole: "#25222a",
    posterpoleGray: "#1f1f1f",
    rosePine: "#232136",
    terminal: "#191715",
    tokyoNight: "#1a1b26",
    tokyoNightStorm: "#24283b",
    tokyoNightMoon: "#222436",
    vesper: "#101010",
  },
} as const satisfies { light: Record<LightPalette, string>; dark: Record<DarkPalette, string> };

function readStoredAppearance(): Appearance {
  const theme = localStorage.getItem(storageKeys.theme);
  const lightPalette = localStorage.getItem(storageKeys.lightPalette);
  const darkPalette = localStorage.getItem(storageKeys.darkPalette);

  return {
    theme: applicationThemes.includes(theme as ApplicationTheme)
      ? (theme as ApplicationTheme)
      : defaultAppearance.theme,
    lightPalette: lightPalettes.includes(lightPalette as LightPalette)
      ? (lightPalette as LightPalette)
      : defaultAppearance.lightPalette,
    darkPalette: darkPalettes.includes(darkPalette as DarkPalette)
      ? (darkPalette as DarkPalette)
      : defaultAppearance.darkPalette,
  };
}

/** Runs before the first paint, so a reload never flashes another mode or palette. */
function getAppearanceScript() {
  const config = JSON.stringify({
    keys: storageKeys,
    defaults: defaultAppearance,
    themes: applicationThemes,
    lightPalettes,
    darkPalettes,
    colors: browserThemeColors,
  });

  return `(function(){try{var c=${config};function r(k,l){var v=localStorage.getItem(c.keys[k]);return l.indexOf(v)>=0?v:c.defaults[k]}var t=r("theme",c.themes);var m=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var p=m==="dark"?r("darkPalette",c.darkPalettes):r("lightPalette",c.lightPalettes);var e=document.documentElement;e.classList.add(m);e.style.colorScheme=m;e.setAttribute("data-palette",p+"-"+m);var s=document.querySelector('meta[name="theme-color"]');if(s)s.setAttribute("content",c.colors[m][p])}catch(e){}})();`;
}

function resolveMode(theme: ApplicationTheme): ResolvedMode {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  const mode = resolveMode(appearance.theme);
  const palette = mode === "dark" ? appearance.darkPalette : appearance.lightPalette;
  const themeColor =
    mode === "dark"
      ? browserThemeColors.dark[appearance.darkPalette]
      : browserThemeColors.light[appearance.lightPalette];

  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.style.colorScheme = mode;
  root.dataset.palette = `${palette}-${mode}`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", themeColor);
}

/**
 * Cross-fades the page into a new mode or palette, so switching between very different themes
 * does not flash. Skipped when nothing visible changes, when the person asks for less motion, and
 * in browsers without typed view transitions, which would also run the navigation styles.
 */
function applyAppearanceSmoothly(appearance: Appearance) {
  const root = document.documentElement;
  const mode = resolveMode(appearance.theme);
  const palette = mode === "dark" ? appearance.darkPalette : appearance.lightPalette;
  const unchanged = root.classList.contains(mode) && root.dataset.palette === `${palette}-${mode}`;
  const canAnimate =
    typeof document.startViewTransition === "function" &&
    window.CSS?.supports?.("selector(:active-view-transition-type(a))") &&
    !prefersReducedMotion();

  if (unchanged || !canAnimate) {
    applyAppearance(appearance);
    return;
  }
  document.startViewTransition({ update: () => applyAppearance(appearance), types: ["theme"] });
}

function storeAppearance(appearance: Appearance) {
  for (const key of Object.keys(storageKeys) as (keyof Appearance)[]) {
    localStorage.setItem(storageKeys[key], appearance[key]);
  }
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [appearance, setAppearanceState] = useState<Appearance>(defaultAppearance);
  const [mounted, setMounted] = useState(false);
  // The first apply only confirms what the inline script painted, so it never animates.
  const applied = useRef(false);
  const systemPrefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const mode: ResolvedMode =
    appearance.theme === "system" ? (systemPrefersDark ? "dark" : "light") : appearance.theme;

  useEffect(() => {
    setAppearanceState(readStoredAppearance());
    setMounted(true);
  }, []);

  // Reads the device mode itself rather than `mode`, which is still the server value while the
  // page hydrates; `systemPrefersDark` is a dependency only to re-apply when the device changes.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    if (!mounted) return;
    storeAppearance(appearance);
    if (applied.current) applyAppearanceSmoothly(appearance);
    else applyAppearance(appearance);
    applied.current = true;
  }, [appearance, mounted, systemPrefersDark]);

  const setAppearance = useCallback((next: Partial<Appearance>) => {
    setAppearanceState((current) => {
      const merged = { ...current, ...next };
      return merged.theme === current.theme &&
        merged.lightPalette === current.lightPalette &&
        merged.darkPalette === current.darkPalette
        ? current
        : merged;
    });
  }, []);

  return (
    <ThemeProviderContext value={{ appearance, mode, setAppearance }}>
      <ScriptOnce>{getAppearanceScript()}</ScriptOnce>
      {children}
    </ThemeProviderContext>
  );
}

export function useTheme() {
  const context = useContext(ThemeProviderContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
