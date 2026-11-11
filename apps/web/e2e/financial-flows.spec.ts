import { randomUUID } from "node:crypto";
import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const pageErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

async function data<T>(request: APIRequestContext, path: string, body?: unknown): Promise<T> {
  const response =
    body === undefined
      ? await request.get(`/api-proxy${path}`)
      : await request.post(`/api-proxy${path}`, { data: body });
  expect(response.ok(), await response.text()).toBeTruthy();
  return (await response.json()).data;
}

async function seed(request: APIRequestContext) {
  const email = `${randomUUID()}@example.test`;
  const password = "browser-test-password-123";
  const response = await request.post("/api/auth/sign-up/email", {
    data: { name: "Browser user", email, password },
  });
  expect(response.ok(), await response.text()).toBeTruthy();
  const people = await data<Array<{ id: string; role: string }>>(request, "/people");
  const categories = await data<Array<{ id: string; name: string; type: string }>>(
    request,
    "/categories",
  );
  const account = await data<{ id: string }>(request, "/accounts", {
    name: "Browser account",
    type: "checking",
  });
  const personId = people.find((person) => person.role === "admin")?.id;
  const categoryId = categories.find(
    (category) => category.type === "expense" && category.name === "Outras despesas",
  )?.id;
  expect(personId).toBeTruthy();
  expect(categoryId).toBeTruthy();
  const preferences = await request.patch("/api-proxy/preferences", {
    data: { defaultPaymentMethod: "pix", defaultAccountId: account.id },
  });
  expect(preferences.ok(), await preferences.text()).toBeTruthy();
  return { email, password, personId, categoryId, accountId: account.id };
}

function field(page: Page, legend: string) {
  return page
    .getByRole("dialog")
    .locator("fieldset")
    .filter({ has: page.locator("legend", { hasText: new RegExp(`^${legend}$`) }) });
}

async function expenseForm(page: Page, name: string) {
  await page.goto("/transactions");
  const dialog = page.getByRole("dialog", { name: "Nova despesa" });
  // Retry until hydration wires the button, but never click again once a dialog is open.
  await expect(async () => {
    if (!(await dialog.isVisible()))
      await page.getByRole("button", { name: "Nova despesa", exact: true }).click();
    await expect(dialog).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });
  await field(page, "Descrição").getByRole("combobox").fill(name);
  await field(page, "Valor").getByRole("textbox").fill("25,50");
  await field(page, "Categoria").getByRole("combobox").click();
  await page.getByRole("option", { name: /^Outras despesas/ }).click();
}

test("login rejects incorrect credentials and then opens the authenticated dashboard", async ({
  page,
}) => {
  const request = page.request;
  const user = await seed(request);
  const signOut = await request.post("/api/auth/sign-out", { data: {} });
  expect(signOut.ok()).toBeTruthy();
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill(user.email);
  await page.getByLabel("Senha", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou senha inválidos." }),
  ).toBeVisible();
  await page.getByLabel("Senha", { exact: true }).fill(user.password);
  const signedIn = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/auth/sign-in/email") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  expect((await signedIn).status()).toBe(200);
  // Vite compiles the dashboard lazily on the first authenticated navigation.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
});

test("creating, editing and settling an expense refreshes the table and persists after reload", async ({
  page,
}) => {
  const request = page.request;
  await seed(request);
  const name = `Browser purchase ${randomUUID()}`;
  await expenseForm(page, name);
  await page.getByRole("button", { name: "Salvar despesa", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  await page.getByRole("button", { name: `Ações de ${name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Editar", exact: true }).click();
  await field(page, "Descrição").getByRole("combobox").fill(`${name} edited`);
  await page.getByRole("button", { name: "Atualizar", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: `${name} edited` });
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: /Registrar pagamento|Marcar como pago/ }).click();
  await expect(page.getByRole("dialog", { name: "Registrar pagamento" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Confirmar|Registrar pagamento/ })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("row").filter({ hasText: `${name} edited` })).toBeVisible();
  const listing = await data<{
    items: Array<{
      name: string;
      isSettled: boolean;
      plannedAmount: number;
      displayAmount: number;
    }>;
  }>(request, "/transactions");
  expect(listing.items.find((item) => item.name === `${name} edited`)).toMatchObject({
    isSettled: true,
    plannedAmount: 25.5,
    displayAmount: 25.5,
  });
});

test("a failed save keeps the form open and an in-flight save blocks duplicate submissions", async ({
  page,
}) => {
  const request = page.request;
  await seed(request);
  const name = `Retry purchase ${randomUUID()}`;
  await expenseForm(page, name);
  await page.route("**/api-proxy/transactions", async (route) => {
    if (route.request().method() === "POST")
      await route.fulfill({ status: 500, json: { error: true, message: "Internal server error" } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Salvar despesa", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Nova despesa" })).toBeVisible();
  await expect(page.getByText("Não foi possível salvar", { exact: false })).toBeVisible();
  await page.unroute("**/api-proxy/transactions");
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let submissions = 0;
  await page.route("**/api-proxy/transactions", async (route) => {
    if (route.request().method() === "POST") {
      submissions++;
      await pending;
    }
    await route.continue();
  });
  const save = page.getByRole("button", { name: "Salvar despesa", exact: true });
  try {
    await save.click();
    await expect(save).toBeDisabled();
    await expect.poll(() => submissions).toBe(1);
  } finally {
    release();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const listing = await data<{ items: Array<{ name: string }> }>(request, "/transactions");
  expect(listing.items.filter((item) => item.name === name)).toHaveLength(1);
});

test("paying an invoice updates its status and creates the account posting", async ({ page }) => {
  const request = page.request;
  const user = await seed(request);
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
  const period = date.slice(0, 7);
  const card = await data<{ id: string }>(request, "/cards", {
    accountId: user.accountId,
    name: "Browser card",
    brand: "visa",
    closingDay: 20,
    dueDay: 25,
    limit: 1000,
  });
  await data(request, "/transactions", {
    type: "expense",
    paymentMethod: "credit_card",
    name: "Card purchase",
    amount: 50,
    purchaseDate: date,
    invoicePeriod: period,
    personId: user.personId,
    categoryId: user.categoryId,
    cardId: card.id,
  });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Registrar pagamento", exact: true }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Confirmar pagamento|Registrar pagamento|Pagar fatura/ })
    .click();
  await expect(page.getByText(/Pagamento registrado|Fatura paga/).first()).toBeVisible();
  const invoices = await data<{ items: Array<{ cardId: string; status: string }> }>(
    request,
    `/invoices?period=${period}`,
  );
  expect(invoices.items.find((invoice) => invoice.cardId === card.id)?.status).toBe("paid");
  const statement = await data<{
    items: Array<{ origin: string; amount: number; accountId: string | null }>;
  }>(request, `/transactions?period=${period}&view=accountStatement&accountIds=${user.accountId}`);
  expect(statement.items).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ origin: "invoicePayment", amount: -50, accountId: user.accountId }),
    ]),
  );
});

test("tag reports count transfers once on desktop and mobile without changing the result", async ({
  page,
}) => {
  const request = page.request;
  const user = await seed(request);
  const tag = await data<{ id: string }>(request, "/tags", { name: "Viagem" });
  const destination = await data<{ id: string }>(request, "/accounts", {
    name: "Destination account",
    type: "checking",
  });
  await data(request, "/transactions", {
    type: "expense",
    paymentMethod: "pix",
    name: "Tagged expense",
    amount: 25.5,
    purchaseDate: "2026-10-16",
    personId: user.personId,
    categoryId: user.categoryId,
    accountId: user.accountId,
    tagIds: [tag.id],
  });
  for (const amount of [287.15, 163.08]) {
    await data(request, "/transactions", {
      type: "transfer",
      paymentMethod: "bank_transfer",
      name: "Tagged transfer",
      amount,
      purchaseDate: "2026-10-16",
      personId: user.personId,
      sourceAccountId: user.accountId,
      destinationAccountId: destination.id,
      tagIds: [tag.id],
      isSettled: false,
    });
  }
  await page.goto("/tags?period=2026-10");
  await expect(
    page.getByRole("columnheader", { name: "Transferências", exact: true }),
  ).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: "Viagem" });
  await expect(row.getByRole("cell").nth(1)).toHaveText(/R\$\s*0,00/);
  await expect(row.getByRole("cell").nth(2)).toHaveText(/R\$\s*25,50/);
  await expect(row.getByRole("cell").nth(3)).toHaveText(/R\$\s*450,23/);
  await expect(row.getByRole("cell").nth(4)).toHaveText(/-R\$\s*25,50/);
  await page.reload();
  await expect(row.getByRole("cell").nth(3)).toHaveText(/R\$\s*450,23/);

  await page.setViewportSize({ width: 390, height: 844 });
  const card = page.getByRole("list", { name: "Etiquetas", exact: true }).getByRole("listitem");
  await expect(card).toBeVisible();
  const mobileValue = (label: string) =>
    card
      .locator("dl > div")
      .filter({ has: page.locator("dt", { hasText: label }) })
      .locator("dd");
  await expect(mobileValue("Receitas")).toHaveText(/R\$\s*0,00/);
  await expect(mobileValue("Despesas")).toHaveText(/R\$\s*25,50/);
  await expect(mobileValue("Transferências")).toHaveText(/R\$\s*450,23/);
  await expect(mobileValue("Resultado")).toHaveText(/-R\$\s*25,50/);
  await page.goto("/tags?period=2026-11");
  await expect(mobileValue("Transferências")).toHaveText(/R\$\s*0,00/);
  await expect(mobileValue("Resultado")).toHaveText(/R\$\s*0,00/);
});
