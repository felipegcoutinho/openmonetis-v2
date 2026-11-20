import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { darkPalettes, lightPalettes } from "@openmonetis/domain/preferences";

/**
 * Every palette the account can choose must exist in CSS, or choosing it leaves the screen in the
 * fallback colours with no error anywhere. These tests read the palette stylesheets the way the
 * browser scopes them: `[data-palette="<palette>-<mode>"]`, plus `[data-palette="<palette>-light"]
 * .dark` for the menus over a light palette, which are always dark.
 */

const palettesDirectory = new URL("./palettes/", import.meta.url);
const palettesIndex = readFileSync(new URL("./palettes.css", import.meta.url), "utf8");
const paletteFiles = readdirSync(palettesDirectory).filter((file) => file.endsWith(".css"));

/** Each palette scope with the custom properties its rules declare. */
const scopes = new Map<string, Set<string>>();
for (const file of paletteFiles) {
  const css = readFileSync(new URL(file, palettesDirectory), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  for (const [, selectors = "", body = ""] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const properties = [...body.matchAll(/(--[\w-]+)\s*:/g)].map(([, name]) => name ?? "");
    for (const [, palette, popup] of selectors.matchAll(
      /\[data-palette="(\w+-(?:light|dark))"\](\s+\.dark)?/g,
    )) {
      const scope = popup ? `${palette} .dark` : `${palette}`;
      const declared = scopes.get(scope) ?? new Set<string>();
      for (const property of properties) declared.add(property);
      scopes.set(scope, declared);
    }
  }
}

/** The colours every palette declares itself; derived tokens come from the OpenMonetis file. */
const requiredProperties = [
  "--background",
  "--foreground",
  "--card",
  "--popover",
  "--primary",
  "--primary-foreground",
  "--secondary",
  "--muted",
  "--muted-foreground",
  "--destructive",
  "--success",
  "--warning",
  "--info",
  "--teal",
  "--brand",
  "--brand-strong",
  "--brand-foreground",
  "--border",
  "--chart-1",
  "--chart-2",
  "--chart-3",
  "--chart-4",
  "--chart-5",
];

const expectedScopes = [
  ...lightPalettes.flatMap((palette) => [`${palette}-light`, `${palette}-light .dark`]),
  ...darkPalettes.map((palette) => `${palette}-dark`),
];

test("every palette file is imported by the palette stylesheet", () => {
  for (const file of paletteFiles) {
    assert.ok(palettesIndex.includes(`@import "./palettes/${file}";`), `${file} is not imported`);
  }
});

test("every palette in the domain has its own colours for each mode and for its menus", () => {
  for (const scope of expectedScopes) {
    const declared = scopes.get(scope);
    assert.ok(declared, `[data-palette] scope "${scope}" is missing`);
    // Dark colours also paint the lists opened inside forms.
    const required = scope.endsWith("-light")
      ? requiredProperties
      : [...requiredProperties, "--popover-field"];
    const missing = required.filter((property) => !declared.has(property));
    assert.deepEqual(missing, [], `"${scope}" does not declare ${missing.join(", ")}`);
  }
});

test("the stylesheets only paint palettes that the domain offers", () => {
  const expected = new Set(expectedScopes);
  const unknown = [...scopes.keys()].filter((scope) => !expected.has(scope));
  assert.deepEqual(unknown, [], `unknown palette scopes: ${unknown.join(", ")}`);
});
