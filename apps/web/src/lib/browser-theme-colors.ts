import type { DarkPalette, LightPalette } from "@openmonetis/domain/preferences";

/**
 * The colour of the phone's system bars for each palette: its canvas, so the app reads as one
 * surface. The page sends it in its `theme-color` tag, and the web app manifest (served by
 * `routes/manifest[.]json.ts`) carries it for the installed app, whose bars some browsers paint
 * only from the manifest.
 */
export const browserThemeColors = {
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

export const webAppManifestPath = "/manifest.json";

const defaultScope = { mode: "light", palette: "openmonetis" } as const;

/**
 * The bar colour of a palette scope, written as in `data-palette` (`nord-dark`). Anything else,
 * including a palette retired since the app was installed, gets the default light canvas.
 */
export function getBrowserThemeColor(scope: string | null | undefined) {
  const match = /^(\w+)-(light|dark)$/.exec(scope ?? "");
  const mode = match?.[2] === "dark" ? "dark" : "light";
  const colors: Record<string, string> = browserThemeColors[mode];
  const palette = match?.[1] ?? "";
  return Object.hasOwn(colors, palette)
    ? colors[palette]
    : browserThemeColors[defaultScope.mode][defaultScope.palette];
}
