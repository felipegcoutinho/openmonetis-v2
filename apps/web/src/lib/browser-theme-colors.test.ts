import assert from "node:assert/strict";
import test from "node:test";
import { darkPalettes, lightPalettes } from "@openmonetis/domain/preferences";
import { browserThemeColors, getBrowserThemeColor } from "./browser-theme-colors";
import { createWebAppManifest } from "./web-app-manifest";

test("each palette scope gets the system bar colour of its own mode", () => {
  for (const palette of lightPalettes) {
    assert.equal(getBrowserThemeColor(`${palette}-light`), browserThemeColors.light[palette]);
  }
  for (const palette of darkPalettes) {
    assert.equal(getBrowserThemeColor(`${palette}-dark`), browserThemeColors.dark[palette]);
  }
});

test("an unknown or missing scope falls back to the default light canvas", () => {
  for (const scope of [null, "", "nord-light", "retired-dark", "openmonetis", "x-dark-extra"]) {
    assert.equal(getBrowserThemeColor(scope), browserThemeColors.light.openmonetis, String(scope));
  }
});

test("the manifest paints the installed app's bars and splash with the appearance colour", () => {
  const manifest = createWebAppManifest(getBrowserThemeColor("nord-dark"));
  assert.equal(manifest.theme_color, "#2e3440");
  assert.equal(manifest.background_color, "#2e3440");
  assert.equal(manifest.id, "/");
  assert.equal(manifest.display, "standalone");
});
