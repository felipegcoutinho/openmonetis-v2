import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test.use({ isMobile: true, hasTouch: true });

for (const width of [320, 360, 390, 430]) {
  test(`the new-transaction button sits on the centre line of a ${width}px phone`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    const signup = await page.request.post("/api/auth/sign-up/email", {
      data: {
        name: "Mobile navigation user",
        email: `${randomUUID()}@example.test`,
        password: "browser-test-password-123",
      },
    });
    expect(signup.ok(), await signup.text()).toBeTruthy();

    await page.goto("/dashboard");
    const tabbar = page.getByRole("navigation", { name: "Navegação principal mobile" });
    const newTransaction = tabbar.getByRole("button", { name: "Novo lançamento ou anotação" });
    await expect(newTransaction).toBeVisible();

    const box = await newTransaction.boundingBox();
    expect(box).not.toBeNull();
    const centre = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    expect(Math.abs(centre - width / 2)).toBeLessThanOrEqual(1);
  });
}
