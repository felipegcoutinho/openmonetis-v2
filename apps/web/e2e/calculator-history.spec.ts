import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("the calculator keeps its history after closing and reloading", async ({ page }) => {
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Calculator history user",
      email: `${randomUUID()}@example.test`,
      password: "browser-test-password-123",
    },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();

  await page.goto("/dashboard");
  const calculator = page.getByRole("dialog", { name: "Calculadora" });
  // The header button only responds once the page has hydrated.
  const openCalculator = () =>
    expect(async () => {
      await page.getByRole("button", { name: "Abrir calculadora" }).click();
      await expect(calculator).toBeVisible({ timeout: 1_000 });
    }).toPass();
  await openCalculator();

  for (const key of ["1", "2", "+", "3", "Enter"]) await page.keyboard.press(key);
  await expect(calculator.locator("output")).toHaveText("15");

  await calculator.getByRole("button", { name: "Fechar" }).click();
  await page.reload();
  await openCalculator();

  await calculator.getByRole("button", { name: "Abrir histórico" }).click();
  const history = calculator.getByRole("region", { name: "Histórico da calculadora" });
  const entry = history.getByRole("button", { name: "Usar 15, de 12 + 3" });
  await expect(entry).toBeVisible();

  await entry.click();
  await expect(calculator.locator("output")).toHaveText("15");
  await expect(calculator.getByRole("button", { name: "Somar" })).toBeVisible();

  await calculator.getByRole("button", { name: "Abrir histórico" }).click();
  await history.getByRole("button", { name: "Limpar histórico" }).click();
  await expect(history.getByText("Os cálculos feitos aqui aparecem nesta lista.")).toBeVisible();
});
