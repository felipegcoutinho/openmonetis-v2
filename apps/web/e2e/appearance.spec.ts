import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const html = (page: Page) => page.locator("html");

/** The installed app's manifest keeps the OpenMonetis primary, whatever the theme on screen. */
const manifestThemeColor = "#fc941d";

/** Every `theme-color` tag on the page; there must be exactly one, with the theme's primary. */
function browserThemeColors(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
      (meta) => meta.content,
    ),
  );
}

/**
 * The installed app needs the manifest link in the server's HTML, sent with credentials so a
 * deployment behind an authenticating proxy still serves it, or Firefox installs a shortcut that
 * opens in the browser.
 */
async function expectInstallableManifest(page: Page) {
  const links = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]')].map((link) => ({
      href: new URL(link.href).pathname + new URL(link.href).search,
      crossOrigin: link.crossOrigin,
    })),
  );
  expect(links).toEqual([{ href: "/manifest.json", crossOrigin: "use-credentials" }]);
  const html = await (await page.request.get("/settings")).text();
  expect(html.slice(0, html.indexOf("</head>"))).toMatch(
    /<link[^>]*rel="manifest"[^>]*crossorigin="use-credentials"|<link[^>]*crossorigin="use-credentials"[^>]*rel="manifest"/,
  );
  const response = await page.request.get("/manifest.json");
  expect(response.ok()).toBeTruthy();
  const manifest = (await response.json()) as { display: string; theme_color?: string };
  expect(manifest.display).toBe("standalone");
  expect(manifest.theme_color).toBe(manifestThemeColor);
}

function isPreferencesSave(url: string, method: string) {
  return method === "PATCH" && new URL(url).pathname === "/api-proxy/preferences";
}

function waitForPreferencesSave(page: Page) {
  return page.waitForResponse((response) =>
    isPreferencesSave(response.url(), response.request().method()),
  );
}

async function chooseDarkPalette(page: Page, name: RegExp) {
  await page.getByRole("combobox", { name: "Tema escuro" }).click();
  await page.getByRole("option", { name }).click();
}

test.use({ colorScheme: "light" });

test("the theme is saved to the account, applied before the first frame and restored after a failed save", async ({
  page,
}) => {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Appearance user",
      email: `${randomUUID()}@example.test`,
      password: "browser-test-password-123",
    },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();

  await page.goto("/settings?tab=preferences");
  const modes = page.getByRole("group", { name: "Modo do aplicativo" });

  await test.step("choosing the dark mode and a dark theme saves both at once", async () => {
    let saved = waitForPreferencesSave(page);
    await modes.getByRole("button", { name: "Escuro" }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(html(page)).toHaveClass(/\bdark\b/);
    await expect(html(page)).toHaveAttribute("data-palette", "openmonetis-dark");

    saved = waitForPreferencesSave(page);
    await chooseDarkPalette(page, /Nord/);
    expect((await saved).ok()).toBeTruthy();
    await expect(html(page)).toHaveAttribute("data-palette", "nord-dark");
    // The status bar takes Nord's primary, with no stale tag left behind.
    await expect.poll(() => browserThemeColors(page)).toEqual(["#88c0d0"]);
    await expectInstallableManifest(page);
  });

  await test.step("the appearance script runs in the head, before any of the body can paint", async () => {
    // A script in the body leaves a window, on a slow stream, where the first frame shows no theme.
    const document = await (await page.request.get("/settings")).text();
    const script = document.indexOf('setAttribute("data-palette"');
    expect(script).toBeGreaterThan(-1);
    expect(script).toBeLessThan(document.indexOf("</head>"));
  });

  await test.step("a reload paints the saved theme from the first frame", async () => {
    // Read before the first frame paints, so a flash of the default theme would be caught.
    await page.addInitScript(() => {
      requestAnimationFrame(() => {
        document.documentElement.dataset.firstFramePalette =
          document.documentElement.dataset.palette ?? "";
        document.documentElement.dataset.firstFrameThemeColor =
          document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content ?? "";
      });
    });
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-first-frame-palette", "nord-dark");
    await expect(html(page)).toHaveAttribute("data-first-frame-theme-color", "#88c0d0");
    // Hydration and the route head must not put the default colour back.
    await expect.poll(() => browserThemeColors(page)).toEqual(["#88c0d0"]);
  });

  await test.step("a browser without the local copy gets the theme from the account", async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(html(page)).toHaveAttribute("data-palette", "nord-dark");
    await expect(html(page)).toHaveClass(/\bdark\b/);
  });

  await test.step("a failed save returns to the saved theme", async () => {
    await page.route("**/api-proxy/preferences", (route) =>
      isPreferencesSave(route.request().url(), route.request().method())
        ? route.fulfill({
            status: 500,
            json: { error: true, message: "Internal server error" },
          })
        : route.fallback(),
    );
    await chooseDarkPalette(page, /Gruvbox/);
    await expect(page.getByText("Não foi possível salvar o tema.")).toBeVisible();
    await expect(html(page)).toHaveAttribute("data-palette", "nord-dark");
    await page.unroute("**/api-proxy/preferences");
  });

  await test.step("a light theme chosen in the search also brings the light mode", async () => {
    const saved = waitForPreferencesSave(page);
    await page.keyboard.press("ControlOrMeta+k");
    const search = page.getByRole("dialog").getByRole("combobox");
    await search.fill("Rosé Pine Dawn");
    await page.getByRole("option", { name: /Rosé Pine Dawn/ }).click();
    expect((await saved).ok()).toBeTruthy();
    await expect(html(page)).toHaveClass(/\blight\b/);
    await expect(html(page)).toHaveAttribute("data-palette", "rosePine-light");
    await expect.poll(() => browserThemeColors(page)).toEqual(["#d7827e"]);
    await expectInstallableManifest(page);
    await expect(modes.getByRole("button", { name: "Claro" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
