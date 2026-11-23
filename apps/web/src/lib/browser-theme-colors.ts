import type { DarkPalette, LightPalette } from "@openmonetis/domain/preferences";

/**
 * The colour of the phone's status bar for each palette: its primary (`--primary`), as hex,
 * because browsers read `theme-color` unevenly when it is written as `oklch()` or `color-mix()`.
 * The appearance script writes it into the page's `theme-color` tag; `palette-contrast.spec.ts`
 * checks every entry against the colour the browser resolves from the palette stylesheets.
 *
 * The web app manifest stays static with the OpenMonetis primary: a manifest that changed with
 * the theme made Firefox for Android install a browser shortcut.
 */
export const browserThemeColors = {
  light: {
    openmonetis: "#fc941d",
    absolutely: "#d97757",
    catppuccin: "#8839ef",
    everforest: "#8da101",
    flexoki: "#205ea6",
    github: "#0969da",
    githubHighContrast: "#0349b4",
    githubColorblind: "#0969da",
    githubLegacy: "#0366d6",
    rosePine: "#d7827e",
    tokyoNight: "#395dae",
  },
  dark: {
    openmonetis: "#eb954e",
    absolutely: "#d97757",
    catppuccin: "#cba6f7",
    everforest: "#a7c080",
    flexoki: "#4385be",
    github: "#58a6ff",
    githubDimmed: "#539bf5",
    githubHighContrast: "#71b7ff",
    githubColorblind: "#58a6ff",
    githubLegacy: "#79b8ff",
    gotham: "#519cac",
    gruvbox: "#fe8019",
    jellybeans: "#ffa560",
    monokai: "#e6db74",
    moonfly: "#80a0ff",
    nord: "#88c0d0",
    posterpole: "#cc9166",
    posterpoleGray: "#cc9166",
    rosePine: "#ea9a97",
    terminal: "#f8b048",
    tokyoNight: "#7aa2f7",
    tokyoNightStorm: "#7aa2f7",
    tokyoNightMoon: "#82aaff",
    vesper: "#ffc799",
  },
} as const satisfies { light: Record<LightPalette, string>; dark: Record<DarkPalette, string> };
