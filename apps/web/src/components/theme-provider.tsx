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
import { browserThemeColors } from "@/lib/browser-theme-colors";
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

/**
 * Paints the stored appearance before the first frame, so a reload never flashes another mode or
 * palette. It belongs in the document head: from the body, a slow stream can paint a frame first.
 */
export function AppearanceScript() {
  return <ScriptOnce>{getAppearanceScript()}</ScriptOnce>;
}

function getAppearanceScript() {
  const config = JSON.stringify({
    keys: storageKeys,
    defaults: defaultAppearance,
    themes: applicationThemes,
    lightPalettes,
    darkPalettes,
    colors: browserThemeColors,
  });

  return `(function(){try{var c=${config};function r(k,l){var v=localStorage.getItem(c.keys[k]);return l.indexOf(v)>=0?v:c.defaults[k]}var t=r("theme",c.themes);var m=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;var p=m==="dark"?r("darkPalette",c.darkPalettes):r("lightPalette",c.lightPalettes);var e=document.documentElement;e.classList.add(m);e.style.colorScheme=m;e.setAttribute("data-palette",p+"-"+m);var b=document.head.querySelector('meta[name="theme-color"]');if(!b){b=document.createElement("meta");b.name="theme-color";document.head.appendChild(b)}b.content=c.colors[m][p]}catch(e){}})();`;
}

function resolveMode(theme: ApplicationTheme): ResolvedMode {
  if (theme !== "system") return theme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyAppearance(appearance: Appearance) {
  const root = document.documentElement;
  const mode = resolveMode(appearance.theme);
  const palette = mode === "dark" ? appearance.darkPalette : appearance.lightPalette;

  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.style.colorScheme = mode;
  root.dataset.palette = `${palette}-${mode}`;
  paintStatusBar(
    mode === "dark"
      ? browserThemeColors.dark[appearance.darkPalette]
      : browserThemeColors.light[appearance.lightPalette],
  );
}

/**
 * The status bar takes the primary of the theme on screen. The page's single `theme-color` tag
 * belongs to the appearance script, which creates it before the first frame; the route head must
 * not render one, because the router renders head tags again on hydration and the second copy
 * kept the default colour. The manifest keeps its fixed colour: Firefox for Android ignores this
 * tag and paints its installed app from the manifest only.
 */
function paintStatusBar(color: string) {
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.append(meta);
  }
  meta.content = color;
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
