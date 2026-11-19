import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("responsive selectors preserve their open state across desktop and mobile", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /uncontrolled|controlled/.test(message.text()))
      errors.push(message.text());
  });
  const signup = await page.request.post("/api/auth/sign-up/email", {
    data: {
      name: "Responsive select user",
      email: `${randomUUID()}@example.test`,
      password: "browser-test-password-123",
    },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  const categoriesResponse = await page.request.get("/api-proxy/categories");
  expect(categoriesResponse.ok()).toBeTruthy();
  const categories = (await categoriesResponse.json()).data as Array<{ id: string; type: string }>;
  const category = categories.find((item) => item.type === "expense");
  expect(category).toBeTruthy();
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/categories/${category?.id}?period=2020-01`);
  const trigger = page.getByRole("combobox", { name: "Considerar lançamentos de", exact: true });
  const allPeople = page.getByRole("option", { name: "Todas as pessoas", exact: true });
  // Only the mobile list has its own close button. Waiting for it confirms the presentation was
  // replaced, so the next action does not reach the list that is being swapped out.
  const mobileClose = page.getByRole("button", { name: "Fechar", exact: true });
  await trigger.click();
  await expect(allPeople).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(mobileClose).toBeVisible();
  await expect(allPeople).toBeVisible();
  await allPeople.click();
  await expect(trigger).toContainText("Todas as pessoas");
  await expect(allPeople).toBeHidden();
  await trigger.click();
  await expect(allPeople).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(mobileClose).toBeHidden();
  await expect(allPeople).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(allPeople).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await trigger.click();
  await mobileClose.click();
  await expect(allPeople).toBeHidden();
  expect(errors).toEqual([]);
});
