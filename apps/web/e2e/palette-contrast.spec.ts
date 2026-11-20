import { expect, test } from "@playwright/test";
import { darkPalettes, lightPalettes } from "../../../packages/domain/src/preferences";

/**
 * Every palette keeps its text readable and its chart series distinguishable. The browser resolves
 * each palette's tokens, `color-mix()` included, and the contrast is measured as WCAG 2.2 defines
 * it: text at least 4.5:1 (AA for body text) and chart series at least 3:1 (non-text contrast).
 * Translucent tokens are composed over the surface they sit on before measuring.
 */

const textContrast = 4.5;
const graphicContrast = 3;

/** Text tokens measured over the canvas and over cards. */
const textTokens = [
  "foreground",
  "muted-foreground",
  "brand-strong",
  "success",
  "destructive",
  "warning",
  "info",
  "teal",
];
/** Text tokens measured over the surface they are drawn on, as `[text, surface]`. */
const filledTokens = [
  ["primary-foreground", "primary"],
  ["brand-foreground", "brand"],
  ["muted-foreground", "muted"],
];
const chartTokens = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"];

/**
 * Checks a palette deliberately misses, each with its reason. Keep this list short: a new palette
 * fixes its colours instead of adding an entry here.
 */
const exceptions: Record<string, string[]> = {
  // The first series is the coral of the OpenMonetis brand; charts also label every series.
  "openmonetis-light": ["chart-1 on card"],
};

const variants = [
  ...lightPalettes.map((palette) => `${palette}-light`),
  ...darkPalettes.map((palette) => `${palette}-dark`),
];

test("every palette keeps text and chart contrast", async ({ page }) => {
  await page.goto("/");

  const failures = await page.evaluate(
    ({
      variants,
      textTokens,
      filledTokens,
      chartTokens,
      exceptions,
      textContrast,
      graphicContrast,
    }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas 2D is unavailable");

      const page = document.createElement("div");
      // Menus are always dark; over a light palette they take its dark family's colours.
      const menu = document.createElement("div");
      menu.className = "dark";
      document.body.append(page, menu);

      /** The token as an opaque sRGB colour, composed over `surface` when it is translucent. */
      function resolve(element: HTMLElement, token: string, surface?: string) {
        element.style.color = `var(--${token})`;
        const colour = getComputedStyle(element).color;
        context?.clearRect(0, 0, 1, 1);
        if (surface && context) {
          context.fillStyle = surface;
          context.fillRect(0, 0, 1, 1);
        }
        if (!context) return "";
        context.fillStyle = colour;
        context.fillRect(0, 0, 1, 1);
        const [red = 0, green = 0, blue = 0] = context.getImageData(0, 0, 1, 1).data;
        return `rgb(${red}, ${green}, ${blue})`;
      }

      function luminance(colour: string) {
        const [red = 0, green = 0, blue = 0] = (colour.match(/\d+/g) ?? []).map((value) => {
          const channel = Number(value) / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      }

      function contrast(first: string, second: string) {
        const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
        return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
      }

      const failures: string[] = [];
      const root = document.documentElement;
      const original = { className: root.className, palette: root.dataset.palette };

      for (const variant of variants) {
        const mode = variant.endsWith("-dark") ? "dark" : "light";
        root.classList.remove("light", "dark");
        root.classList.add(mode);
        root.dataset.palette = variant;

        function check(label: string, ratio: number, minimum: number) {
          if (ratio < minimum && !exceptions[variant]?.includes(label)) {
            failures.push(`${variant}: ${label} is ${ratio.toFixed(2)}:1, below ${minimum}:1`);
          }
        }

        const surfaces = { background: resolve(page, "background"), card: "" };
        surfaces.card = resolve(page, "card", surfaces.background);
        for (const token of textTokens) {
          for (const [name, surface] of Object.entries(surfaces)) {
            check(
              `${token} on ${name}`,
              contrast(resolve(page, token, surface), surface),
              textContrast,
            );
          }
        }
        for (const [token, surfaceToken = ""] of filledTokens) {
          const surface = resolve(page, surfaceToken, surfaces.card);
          check(
            `${token} on ${surfaceToken}`,
            contrast(resolve(page, token ?? "", surface), surface),
            textContrast,
          );
        }
        for (const token of chartTokens) {
          check(
            `${token} on card`,
            contrast(resolve(page, token, surfaces.card), surfaces.card),
            graphicContrast,
          );
        }

        const popover = resolve(menu, "popover", resolve(menu, "background"));
        for (const token of ["foreground", "muted-foreground"]) {
          check(
            `menu ${token} on popover`,
            contrast(resolve(menu, token, popover), popover),
            textContrast,
          );
        }
      }

      root.className = original.className;
      if (original.palette) root.dataset.palette = original.palette;
      page.remove();
      menu.remove();
      return failures;
    },
    {
      variants,
      textTokens,
      filledTokens,
      chartTokens,
      exceptions,
      textContrast,
      graphicContrast,
    },
  );

  expect(failures, failures.join("\n")).toEqual([]);
});
