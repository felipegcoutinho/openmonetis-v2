import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("distribution renders a balanced Sankey, monthly filters, CSV, privacy and mobile category lists", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /uncontrolled|controlled/.test(message.text()))
      errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const request = page.request;
  const signup = await request.post("/api/auth/sign-up/email", {
    data: {
      name: "Report user",
      email: `${randomUUID()}@example.test`,
      password: "browser-test-password-123",
    },
  });
  expect(signup.ok(), await signup.text()).toBeTruthy();
  async function data<T>(path: string, body?: unknown): Promise<T> {
    const response =
      body === undefined
        ? await request.get(`/api-proxy${path}`)
        : await request.post(`/api-proxy${path}`, { data: body });
    expect(response.ok(), await response.text()).toBeTruthy();
    return (await response.json()).data;
  }
  const people = await data<Array<{ id: string; role: string }>>("/people");
  const categories = await data<Array<{ id: string; name: string; type: string }>>("/categories");
  const personId = people.find((person) => person.role === "admin")?.id;
  async function category(name: string, type: "income" | "expense", parentId?: string) {
    return (
      categories.find((item) => item.name === name && item.type === type) ??
      (await data<{ id: string }>("/categories", { name, type, parentId }))
    );
  }
  const incomeId = (await category("Salário", "income")).id;
  const freelanceId = (await category("Freelance", "income")).id;
  const expenseId = (await category("Outras despesas", "expense")).id;
  const account = await data<{ id: string }>("/accounts", {
    name: "Report account",
    type: "checking",
  });
  const base = {
    paymentMethod: "pix",
    purchaseDate: "2020-01-10",
    personId,
    accountId: account.id,
  };
  await data("/transactions", {
    ...base,
    name: "Salary",
    type: "income",
    categoryId: incomeId,
    amount: 6500,
  });
  await data("/transactions", {
    ...base,
    name: "Freelance",
    type: "income",
    categoryId: freelanceId,
    amount: 1500,
  });
  for (const [name, amount] of [
    ["Moradia", 2600],
    ["Alimentação", 1400],
    ["Transporte", 700],
    ["Saúde", 600],
    ["Lazer", 500],
    ["Outras despesas", 400],
  ] as const) {
    const parent = await category(name, "expense");
    const expenseCategory =
      name === "Moradia" ? await category("Aluguel", "expense", parent.id) : parent;
    await data("/transactions", {
      ...base,
      name,
      type: "expense",
      categoryId: expenseCategory.id,
      amount,
    });
  }
  await data("/transactions", {
    ...base,
    name: "Recurring",
    type: "expense",
    categoryId: expenseId,
    amount: 100,
    condition: "recurring",
    recurrenceFrequency: "monthly",
  });
  await page.setViewportSize({ width: 1440, height: 1200 });
  await page.goto("/reports/financial-distribution?period=2020-01");
  await expect(
    page.getByRole("heading", { name: "Distribuição financeira", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "O caminho do seu dinheiro" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Gráfico de distribuição financeira" })
      .locator("path[fill-opacity]"),
  ).toHaveCount(9);
  const summary = page.getByRole("region", { name: /^Resultado do mês/ });
  await expect(summary).toContainText(/1\.800,00/);
  await page.getByRole("tab", { name: "Com previsões" }).click();
  await expect(page).toHaveURL(/mode=forecast/);
  await expect(summary).toContainText(/1\.700,00/);
  const imageDownloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar imagem", exact: true }).click();
  const imageDownload = await imageDownloadEvent;
  expect(imageDownload.suggestedFilename()).toBe("distribuicao-financeira-2020-01-forecast.png");
  const imagePath = await imageDownload.path();
  expect(imagePath).toBeTruthy();
  const image = await readFile(imagePath as string);
  expect(image.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  await page.getByRole("button", { name: "Expandir subcategorias de Moradia" }).click();
  await expect(page.getByRole("link", { name: "Aluguel", exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await download).suggestedFilename()).toBe("distribuicao-financeira-2020-01-forecast.csv");
  await page.getByRole("button", { name: "Ocultar valores", exact: true }).click();
  await expect(page.getByText("Gráfico oculto pelo modo privacidade.")).toBeVisible();
  await expect(summary.getByRole("img", { name: "Percentual oculto", exact: true })).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Baixar imagem", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Mostrar valores", exact: true }).click();
  await page.screenshot({
    path: "/tmp/openmonetis-financial-distribution-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Despesas por categoria" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
  await page.getByRole("combobox", { name: "Pessoa", exact: true }).click();
  await page.getByRole("option", { name: "Todas as pessoas", exact: true }).click();
  await expect(page).toHaveURL(/personScope=all/);
  await expect(summary).toContainText(/1\.700,00/);
  await page.screenshot({
    path: "/tmp/openmonetis-financial-distribution-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Mês anterior", exact: true }).click();
  await expect(page.getByText("Nenhuma movimentação neste recorte")).toBeVisible();
  await page.getByRole("button", { name: "Próximo mês", exact: true }).click();
  await expect(page.getByRole("heading", { name: "O caminho do seu dinheiro" })).toBeVisible();
  await page.getByRole("link", { name: "Outras despesas", exact: true }).last().click();
  await expect(page).toHaveURL(new RegExp(`/categories/${expenseId}`));
  expect(errors).toEqual([]);
});
