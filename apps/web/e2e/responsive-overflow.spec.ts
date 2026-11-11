import { randomUUID } from "node:crypto";
import { expect, type Page, test } from "@playwright/test";

const mobileViewport = { width: 390, height: 844 };

const staticRoutes = [
  "/dashboard",
  "/transactions",
  "/transactions/import",
  "/inbox",
  "/accounts",
  "/cards",
  "/categories",
  "/budgets",
  "/goals",
  "/people",
  "/tags",
  "/notes",
  "/attachments",
  "/settings",
  "/changelog",
  "/reports/ai-diagnoses",
  "/reports/category-trends",
  "/reports/commitments",
  "/reports/financial-distribution",
  "/reports/installments",
  "/reports/recurring-transactions",
];

test.use({ viewport: mobileViewport, isMobile: true, hasTouch: true });

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function seedFinancialData(page: Page) {
  const request = page.request;
  const signup = await request.post("/api/auth/sign-up/email", {
    data: {
      name: "Responsive layout user",
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
  const categoryId = (name: string, type: "income" | "expense") =>
    categories.find((item) => item.name === name && item.type === type)?.id ?? null;
  const account = await data<{ id: string }>("/accounts", {
    name: "Conta com um nome bem longo para testar quebras",
    type: "checking",
  });

  const today = new Date();
  for (let monthsAgo = 0; monthsAgo < 4; monthsAgo++) {
    const purchaseDate = isoDate(
      new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 5)),
    );
    const base = { paymentMethod: "pix", purchaseDate, personId, accountId: account.id };
    await data("/transactions", {
      ...base,
      name: "Salário",
      type: "income",
      categoryId: categoryId("Salário", "income"),
      amount: 7800,
    });
    for (const [name, amount] of [
      ["Moradia", 2563.3],
      ["Mercado", 695.75 + monthsAgo * 40],
      ["Transporte", 316.75],
      ["Saúde", 129.9],
      ["Lazer", 164 + monthsAgo * 25],
      ["Restaurantes", 240.5],
    ] as const) {
      await data("/transactions", {
        ...base,
        name: `${name} com descrição longa o suficiente para quebrar`,
        type: "expense",
        categoryId: categoryId(name, "expense"),
        amount,
      });
    }
  }

  await data("/transactions", {
    paymentMethod: "pix",
    purchaseDate: isoDate(today),
    personId,
    accountId: account.id,
    name: "Notebook parcelado",
    type: "expense",
    condition: "installment",
    installmentCount: 8,
    categoryId: categoryId("Compras", "expense"),
    amount: 7199.2,
  });

  return { accountId: account.id };
}

async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test("no page scrolls horizontally on a 390px phone", async ({ page }) => {
  test.setTimeout(600_000);
  const { accountId } = await seedFinancialData(page);
  const routes = [...staticRoutes, `/accounts/${accountId}`];
  const overflowing: string[] = [];

  for (const route of routes) {
    await page.goto(route);
    // The dev server compiles each route on its first visit, so allow a cold start.
    await expect(page.locator("main h1:visible").first()).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-slot="skeleton"]:visible')).toHaveCount(0, {
      timeout: 60_000,
    });
    const overflow = await horizontalOverflow(page);
    if (overflow > 0) overflowing.push(`${route} (+${overflow}px)`);
  }

  expect(overflowing).toEqual([]);
});
