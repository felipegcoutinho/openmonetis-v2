import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { ListCategoryTrendsQuerySchema } from "@openmonetis/validators/category-trends";
import {
  ListTransactionsQuerySchema,
  TransactionInputSchema,
  type TransactionOutput,
} from "@openmonetis/validators/transactions";

test("recurring income actions preserve history, deadlines and projections", {
  skip: process.env.RECURRING_INTEGRATION_TEST !== "1",
}, async () => {
  const require = createRequire(new URL("../../../../packages/db/package.json", import.meta.url));
  require("dotenv").config({
    path: new URL("../../../../.env", import.meta.url).pathname,
    quiet: true,
  });
  const { Pool } = require("pg");
  const { migrate } = require("drizzle-orm/node-postgres/migrator");
  const { resolveDatabaseUrl } = await import("../../../../packages/db/src/database-url");
  assert.notEqual(process.env.NODE_ENV, "production");
  const connectionUrl = new URL(process.env.TEST_DATABASE_URL ?? resolveDatabaseUrl());
  const admin = new Pool({ connectionString: connectionUrl.toString() });
  const databaseName = `openmonetis_recurring_test_${Date.now()}`;
  const originalExternalUrl = process.env.EXTERNAL_DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  let applicationPool: { end(): Promise<void> } | undefined;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  try {
    connectionUrl.pathname = `/${databaseName}`;
    process.env.NODE_ENV = "test";
    process.env.EXTERNAL_DATABASE_URL = connectionUrl.toString();
    const { db, pool, ...schema } = await import("@openmonetis/db");
    applicationPool = pool;
    await migrate(db, {
      migrationsFolder: new URL("../../../../packages/db/drizzle", import.meta.url).pathname,
    });
    const transactions = await import("./transactions.repository");
    const recurring = await import("./recurring-transactions.repository");
    const accounts = await import("./accounts.repository");
    const cards = await import("./cards.repository");
    const categories = await import("./categories.repository");
    const people = await import("./people.repository");
    const tags = await import("./tags.repository");
    const { createTransactionsService } = await import("../services/transactions.service");
    const { createCategoryTrendsService } = await import("../services/category-trends.service");
    const { categoryTrendsRepository } = await import("./category-trends.repository");
    const { createDashboardService } = await import("../services/dashboard.service");
    const { dashboardRepository } = await import("./dashboard.repository");
    const { accountsRepository } = accounts;
    const { createAccountsService } = await import("../services/accounts.service");
    const [owner, other] = await db
      .insert(schema.user)
      .values([
        { name: "Owner", email: "owner@example.test" },
        { name: "Other", email: "other@example.test" },
      ])
      .returning();
    const [person] = await db
      .insert(schema.people)
      .values({ userId: owner.id, name: "Admin", role: "admin" })
      .returning();
    const [account] = await db
      .insert(schema.financialAccounts)
      .values({ userId: owner.id, name: "Test", type: "checking" })
      .returning();
    const [category] = await db
      .insert(schema.categories)
      .values({ userId: owner.id, name: "Salário", type: "income" })
      .returning();
    const [tag] = await db
      .insert(schema.tags)
      .values({ userId: owner.id, name: "Trabalho", nameKey: "trabalho" })
      .returning();
    const service = createTransactionsService(
      {
        ...transactions,
        ...recurring,
        ...accounts,
        ...cards,
        ...categories,
        ...people,
        listTagsByIdsForUser: tags.listTagsByIdsForUser,
        getAccountBalanceSnapshotForUser: async () => ({ displayed: 10000, persisted: 10000 }),
      },
      { cleanupOrphans: async () => ({ deletedCount: 0 }) },
      { synchronize: async () => {} },
    );
    const base = TransactionInputSchema.parse({
      type: "income",
      condition: "recurring",
      paymentMethod: "pix",
      name: "Salário",
      amount: 1000,
      purchaseDate: "2026-01-10",
      personId: person.id,
      accountId: account.id,
      categoryId: category.id,
      recurrenceFrequency: "monthly",
      recurrenceEndDate: "2026-05-10",
      isSettled: false,
      tagIds: [tag.id],
    });
    const first = await service.createTransaction({ ...base, userId: owner.id });
    const list = (period: string) =>
      service.listTransactions(
        owner.id,
        ListTransactionsQuerySchema.parse({ period, pageSize: 100 }),
        false,
      );
    const occurrence = async (period: string, name = "Salário") => {
      const item = (await list(period)).items.find((item) => item.name === name);
      assert.ok(item, `Expected ${name} in ${period}`);
      return item;
    };
    const ruleId = (item: { recurringRuleId: string | null }) => {
      assert.ok(item.recurringRuleId);
      return item.recurringRuleId;
    };
    const historicalFields = ({ updatedAt: _updatedAt, ...item }: TransactionOutput) => item;
    assert.equal(first.recurrenceEndDate, "2026-05-10");
    assert.equal((await list("2026-05")).total, 1);
    assert.equal((await list("2026-06")).total, 0);
    await service.settleRecurringOccurrence(
      ruleId(first),
      "2026-01-10",
      owner.id,
      true,
      "2026-01-10",
    );
    await service.settleRecurringOccurrence(
      ruleId(first),
      "2026-02-10",
      owner.id,
      true,
      "2026-02-10",
    );
    const january = await occurrence("2026-01");
    const february = await occurrence("2026-02");
    await assert.rejects(
      service.applyRecurringRuleAction(ruleId(first), owner.id, {
        action: "skip",
        occurrenceDate: "2026-02-10",
      }),
      { code: "RECURRING_OCCURRENCE_SETTLED" },
    );
    const future = await service.updateRecurringRule(
      ruleId(first),
      owner.id,
      {
        ...base,
        name: "Salário reajustado",
        amount: 1200,
        purchaseDate: "2026-03-10",
        recurrenceEndDate: undefined,
      },
      { scope: "future", occurrenceDate: "2026-03-10" },
    );
    assert.equal(future.recurrenceEndDate, "2026-05-10");
    await service.applyRecurringRuleAction(ruleId(future), owner.id, {
      action: "skip",
      occurrenceDate: "2026-03-10",
    });
    assert.equal((await list("2026-03")).total, 0);
    const april = await occurrence("2026-04", "Salário reajustado");
    assert.equal(april.displayAmount, 1200);
    assert.deepEqual(april.tagIds, [tag.id]);
    await service.applyRecurringRuleAction(ruleId(april), owner.id, {
      action: "stop",
      occurrenceDate: "2026-05-10",
    });
    assert.deepEqual(historicalFields(await occurrence("2026-01")), historicalFields(january));
    assert.deepEqual(historicalFields(await occurrence("2026-02")), historicalFields(february));
    assert.equal((await list("2026-05")).total, 0);
    const report = createCategoryTrendsService(categoryTrendsRepository);
    const reportFor = (period: string) =>
      report.list(
        owner.id,
        ListCategoryTrendsQuerySchema.parse({ startPeriod: period, endPeriod: period }),
      );
    assert.equal((await reportFor("2026-01")).summary.incomeAmount, 1000);
    assert.equal((await reportFor("2026-05")).summary.incomeAmount, 0);
    const dashboard = createDashboardService(dashboardRepository, { list: async () => [] });
    assert.equal((await dashboard.getCategoryBreakdown("2026-01", owner.id)).incomeTotal, 1000);
    assert.equal((await dashboard.getCategoryBreakdown("2026-05", owner.id)).incomeTotal, 0);
    const accountService = createAccountsService(accountsRepository);
    assert.equal(
      (await accountService.getBalanceSnapshot(account.id, owner.id, "2026-02")).displayed,
      2000,
    );
    // Ending a series must remove later scheduled versions too, without hiding past receipts.
    const versioned = await service.createTransaction({
      ...base,
      name: "Versionada",
      recurrenceEndDate: null,
      userId: owner.id,
    });
    await service.updateRecurringRule(
      ruleId(versioned),
      owner.id,
      { ...base, name: "Versionada futura", purchaseDate: "2026-07-10", recurrenceEndDate: null },
      { scope: "future", occurrenceDate: "2026-07-10" },
    );
    await service.changeRecurringRuleStatus(ruleId(versioned), owner.id, "cancelled", "2026-04-10");
    assert.ok(await occurrence("2026-02", "Versionada"));
    assert.equal(
      (await list("2026-07")).items.some((item) => item.name.startsWith("Versionada")),
      false,
    );
    // Paused income can resume, keeping its historical gap and its configured deadline.
    const paused = await service.createTransaction({ ...base, name: "Pausada", userId: owner.id });
    await service.applyRecurringRuleAction(ruleId(paused), owner.id, {
      action: "pause",
      occurrenceDate: "2026-03-10",
    });
    assert.ok(await occurrence("2026-02", "Pausada"));
    assert.equal(
      (await list("2026-03")).items.some((item) => item.name === "Pausada"),
      false,
    );
    await service.applyRecurringRuleAction(ruleId(paused), owner.id, {
      action: "resume",
      occurrenceDate: "2026-04-10",
    });
    assert.ok(await occurrence("2026-04", "Pausada"));
    assert.equal(
      (await list("2026-03")).items.some((item) => item.name === "Pausada"),
      false,
    );
    assert.equal(
      (await list("2026-06")).items.some((item) => item.name === "Pausada"),
      false,
    );
    // The user deadline is independent of internal version boundaries and can be extended or cleared.
    const limited = await service.createTransaction({ ...base, name: "Prazo", userId: owner.id });
    await service.updateRecurringRule(
      ruleId(limited),
      owner.id,
      { ...base, name: "Prazo", purchaseDate: "2026-03-10", recurrenceEndDate: "2026-07-10" },
      { scope: "future", occurrenceDate: "2026-03-10" },
    );
    assert.ok(await occurrence("2026-07", "Prazo"));
    assert.equal(
      (await list("2026-08")).items.some((item) => item.name === "Prazo"),
      false,
    );
    const last = await occurrence("2026-07", "Prazo");
    await service.updateRecurringRule(
      ruleId(last),
      owner.id,
      { ...base, name: "Prazo", purchaseDate: "2026-07-10", recurrenceEndDate: null },
      { scope: "future", occurrenceDate: "2026-07-10" },
    );
    assert.ok(await occurrence("2027-01", "Prazo"));
    await assert.rejects(
      service.updateRecurringRule(
        ruleId(last),
        owner.id,
        { ...base, purchaseDate: "2026-07-10", recurrenceEndDate: "2026-08-10" },
        { scope: "single", occurrenceDate: "2026-07-10" },
      ),
      { code: "RECURRING_END_DATE_SCOPE_UNSUPPORTED" },
    );
    await assert.rejects(
      service.applyRecurringRuleAction(ruleId(first), other.id, {
        action: "stop",
        occurrenceDate: "2026-01-10",
      }),
      { code: "RECURRING_RULE_NOT_FOUND" },
    );
    await assert.rejects(
      service.settleRecurringOccurrence(ruleId(first), "2026-06-10", owner.id, true),
      { code: "INVALID_RECURRING_OCCURRENCE" },
    );
    const { OpenAPIHono } = await import("@hono/zod-openapi");
    const { createTransactionsRoute } = await import("../routes/transactions");
    const { ApiError } = await import("../utils/errors");
    const app = new OpenAPIHono<{ Variables: { userId: string } }>();
    app.use("*", async (context, next) => {
      context.set("userId", owner.id);
      await next();
    });
    app.onError((error, context) =>
      error instanceof ApiError
        ? context.json({ error: true, code: error.code, message: error.message }, error.status)
        : context.json({ error: true, message: "Internal error" }, 500),
    );
    const { createRecurringTransactionsService } = await import(
      "../services/recurring-transactions.service"
    );
    const { createRecurringTransactionsRoute } = await import("../routes/recurring-transactions");
    const { RecurringTransactionsReportOutputSchema } = await import(
      "@openmonetis/validators/recurring-transactions"
    );
    const general = createRecurringTransactionsService(
      recurring.recurringTransactionsRepository,
      () => "2026-03-01",
    );
    app.route("/transactions", createTransactionsRoute(service));
    app.route("/recurring-transactions", createRecurringTransactionsRoute(general));
    const request = (path: string, body: unknown) =>
      app.request(`http://test/transactions${path === "/" ? "" : path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal((await request("/", { ...base, recurrenceEndDate: "2025-01-01" })).status, 400);
    assert.equal(
      (
        await request(`/recurring-rules/${first.recurringRuleId}/actions`, {
          action: "skip",
          occurrenceDate: "bad",
        })
      ).status,
      400,
    );
    const concurrent = await service.createTransaction({
      ...base,
      name: "Concorrente",
      userId: owner.id,
    });
    const outcomes = await Promise.all([
      request(`/recurring-rules/${concurrent.recurringRuleId}/actions`, {
        action: "skip",
        occurrenceDate: "2026-03-10",
      }),
      request(`/recurring-rules/${concurrent.recurringRuleId}/actions`, {
        action: "skip",
        occurrenceDate: "2026-03-10",
      }),
    ]);
    assert.deepEqual(outcomes.map((response) => response.status).sort(), [200, 400]);
    const raced = await service.createTransaction({
      ...base,
      name: "Baixa concorrente",
      userId: owner.id,
    });
    const race = await Promise.allSettled([
      service.settleRecurringOccurrence(ruleId(raced), "2026-03-10", owner.id, true),
      service.applyRecurringRuleAction(ruleId(raced), owner.id, {
        action: "skip",
        occurrenceDate: "2026-03-10",
      }),
    ]);
    assert.equal(race.filter((result) => result.status === "fulfilled").length, 1);
    const raceItem = (await list("2026-03")).items.find(
      (item) => item.name === "Baixa concorrente",
    );
    assert.equal(Boolean(raceItem?.isSettled), race[0].status === "fulfilled");

    // The limit applies to the occurrence date; its credit card invoice can fall in the next month.
    const [expenseCategory] = await db
      .insert(schema.categories)
      .values({ userId: owner.id, name: "Assinatura", type: "expense" })
      .returning();
    const [card] = await db
      .insert(schema.cards)
      .values({
        userId: owner.id,
        accountId: account.id,
        name: "Cartão",
        dueDay: 28,
        closingDay: 20,
        limit: "10000",
      })
      .returning();
    const cardRecurring = await service.createTransaction({
      ...base,
      type: "expense",
      name: "Assinatura",
      categoryId: expenseCategory.id,
      paymentMethod: "credit_card",
      accountId: null,
      cardId: card.id,
      amount: 100,
      purchaseDate: "2026-01-25",
      recurrenceEndDate: "2026-02-25",
      isSettled: null,
      userId: owner.id,
    });
    assert.equal(
      (await list("2026-03")).items.find((item) => item.name === "Assinatura")?.purchaseDate,
      "2026-02-25",
    );
    assert.equal(
      (await list("2026-04")).items.some((item) => item.name === "Assinatura"),
      false,
    );
    const { invoicesRepository } = await import("./invoices.repository");
    const { createInvoicesService } = await import("../services/invoices.service");
    const invoices = createInvoicesService(invoicesRepository);
    const { recurringExpensesRepository } = await import("./recurring-expenses.repository");
    const { createRecurringExpensesService } = await import(
      "../services/recurring-expenses.service"
    );
    const management = await createRecurringExpensesService(
      recurringExpensesRepository,
      () => "2026-02-01",
    ).report("2026-02", owner.id);
    assert.equal(management.summary.activeCount, 1);
    assert.equal(management.items[0].recurrenceEndDate, "2026-02-25");
    assert.equal(
      (await invoices.get("2026-03", owner.id)).items.find((item) => item.cardId === card.id)
        ?.amount,
      100,
    );
    assert.equal(
      (await invoices.get("2026-04", owner.id)).items.some((item) => item.cardId === card.id),
      false,
    );
    // Skipping the final date cannot create an occurrence after the deadline.
    const terminal = await service.createTransaction({
      ...base,
      name: "Última",
      recurrenceEndDate: "2026-01-10",
      userId: owner.id,
    });
    await service.applyRecurringRuleAction(ruleId(terminal), owner.id, {
      action: "skip",
      occurrenceDate: "2026-01-10",
    });
    assert.equal(
      (await list("2026-02")).items.some((item) => item.name === "Última"),
      false,
    );
    // General management separates income/expenses, deduplicates versions and retains ended series.
    assert.deepEqual((await general.report({ type: "income" }, other.id)).items, []);
    const [otherPerson] = await db
      .insert(schema.people)
      .values({ userId: other.id, name: "Other admin", role: "admin" })
      .returning();
    const [otherAccount] = await db
      .insert(schema.financialAccounts)
      .values({ userId: other.id, name: "Other account", type: "checking" })
      .returning();
    const [otherIncomeCategory, otherExpenseCategory] = await db
      .insert(schema.categories)
      .values([
        { userId: other.id, name: "Other income", type: "income" },
        { userId: other.id, name: "Other expense", type: "expense" },
      ])
      .returning();
    const otherInput = {
      ...base,
      personId: otherPerson.id,
      accountId: otherAccount.id,
      categoryId: otherIncomeCategory.id,
      tagIds: [],
      name: "Receita gerenciada",
      userId: other.id,
    };
    const managed = await service.createTransaction(otherInput);
    const managedVersion = await service.updateRecurringRule(
      ruleId(managed),
      other.id,
      { ...otherInput, name: "Receita reajustada", amount: 1500, purchaseDate: "2026-04-10" },
      { scope: "future", occurrenceDate: "2026-04-10" },
    );
    await service.createTransaction({
      ...otherInput,
      name: "Despesa gerenciada",
      type: "expense",
      categoryId: otherExpenseCategory.id,
      amount: 50,
    });
    let incomeReport = await general.report({ type: "income" }, other.id);
    RecurringTransactionsReportOutputSchema.parse(incomeReport);
    assert.equal(incomeReport.items.length, 1);
    assert.deepEqual(
      incomeReport.projections.slice(0, 3).map((item) => item.total),
      [1000, 1500, 1500],
    );
    assert.equal(incomeReport.summary.projectionTotal, 4000);
    assert.equal(incomeReport.items[0].actionDate, "2026-03-10");
    assert.equal((await general.report({ type: "expense" }, other.id)).summary.projectedTotal, 50);
    assert.equal(
      (await general.report({ type: "income" }, owner.id)).items.some(
        (item) => item.name === "Receita gerenciada",
      ),
      false,
    );
    await assert.rejects(
      service.getRecurringRuleOccurrence(ruleId(managed), "2026-03-10", owner.id),
      { code: "RECURRING_RULE_NOT_FOUND" },
    );
    const editable = await service.getRecurringRuleOccurrence(
      ruleId(managed),
      "2026-03-10",
      other.id,
    );
    assert.equal(editable.recurrenceEndDate, "2026-05-10");
    assert.equal(editable.accountId, otherAccount.id);
    assert.equal(editable.personId, otherPerson.id);
    assert.equal(editable.isRecurring, true);
    const taggedEditable = await service
      .getRecurringRuleOccurrence(ruleId(terminal), "2026-01-10", owner.id)
      .then(
        () => null,
        (error: { code: string }) => error.code,
      );
    assert.equal(taggedEditable, "INVALID_RECURRING_OCCURRENCE");
    await service.applyRecurringRuleAction(ruleId(managed), other.id, {
      action: "pause",
      occurrenceDate: "2026-03-10",
    });
    incomeReport = await general.report({ type: "income" }, other.id);
    assert.equal(incomeReport.items.length, 1);
    assert.equal(incomeReport.items[0].status, "paused");
    assert.equal(incomeReport.summary.projectedTotal, 0);
    await service.applyRecurringRuleAction(incomeReport.items[0].id, other.id, {
      action: "resume",
      occurrenceDate: incomeReport.items[0].actionDate as string,
    });
    incomeReport = await general.report({ type: "income" }, other.id);
    assert.equal(incomeReport.items[0].status, "active");
    await service.applyRecurringRuleAction(incomeReport.items[0].id, other.id, {
      action: "skip",
      occurrenceDate: incomeReport.items[0].actionDate as string,
    });
    incomeReport = await general.report({ type: "income" }, other.id);
    assert.equal(incomeReport.items.length, 1);
    assert.equal(incomeReport.items[0].actionDate, "2026-04-10");
    await service.applyRecurringRuleAction(ruleId(managedVersion), other.id, {
      action: "stop",
      occurrenceDate: "2026-04-10",
    });
    incomeReport = await general.report({ type: "income" }, other.id);
    assert.equal(incomeReport.items.length, 1);
    assert.equal(incomeReport.items[0].status, "ended");
    assert.equal(incomeReport.items[0].actionDate, null);
    // March was skipped and the series stops in April, so nothing remains to project.
    assert.equal(incomeReport.summary.projectionTotal, 0);
    const generalResponse = await app.request(
      "http://test/recurring-transactions/report?type=income",
    );
    assert.equal(generalResponse.status, 200);
    const generalBody = await generalResponse.json();
    RecurringTransactionsReportOutputSchema.parse(generalBody.data);
    assert.equal(JSON.stringify(generalBody).includes('"userId"'), false);
    assert.equal(
      (await app.request("http://test/recurring-transactions/report?type=bad")).status,
      400,
    );
    assert.equal(
      (await app.request("http://test/recurring-transactions/report?type=transfer")).status,
      400,
    );
    assert.equal(
      (
        await app.request(
          `http://test/transactions/recurring-rules/${ruleId(managed)}/occurrence?occurrenceDate=2026-03-10`,
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await app.request(
          `http://test/transactions/recurring-rules/${ruleId(terminal)}/occurrence?occurrenceDate=bad`,
        )
      ).status,
      400,
    );
    const cardEditable = await app.request(
      `http://test/transactions/recurring-rules/${ruleId(cardRecurring)}/occurrence?occurrenceDate=2026-02-25`,
    );
    assert.equal(cardEditable.status, 200);
    const cardBody = await cardEditable.json();
    assert.equal(cardBody.data.period, "2026-03");
    assert.deepEqual(cardBody.data.tagIds, [tag.id]);

    // Regression: a series with isolated edits can change date/frequency from one occurrence on.
    const rescheduleBase = {
      ...base,
      name: "Agenda editada",
      purchaseDate: "2026-01-31",
      recurrenceEndDate: "2026-12-31",
    };
    const scheduled = await service.createTransaction({ ...rescheduleBase, userId: owner.id });
    await service.settleRecurringOccurrence(
      ruleId(scheduled),
      "2026-02-28",
      owner.id,
      true,
      "2026-02-28",
    );
    const beforeFebruary = historicalFields(await occurrence("2026-02", "Agenda editada"));
    const isolated = await service.updateRecurringRule(
      ruleId(scheduled),
      owner.id,
      {
        ...rescheduleBase,
        purchaseDate: "2026-03-31",
        name: "Agenda isolada",
      },
      { scope: "single", occurrenceDate: "2026-03-31" },
    );
    const august = await occurrence("2026-08", "Agenda editada");
    await service.settleRecurringOccurrence(
      ruleId(august),
      "2026-08-31",
      owner.id,
      true,
      "2026-08-31",
    );
    const changedSchedule = { ...rescheduleBase, name: "Agenda nova", purchaseDate: "2026-03-15" };
    await assert.rejects(
      service.updateRecurringRule(ruleId(isolated), owner.id, changedSchedule, {
        scope: "future",
        occurrenceDate: "2026-03-31",
      }),
      { code: "SETTLEMENT_REQUIRES_UNDO" },
    );
    assert.equal((await occurrence("2026-03", "Agenda isolada")).purchaseDate, "2026-03-31");
    await service.settleRecurringOccurrence(ruleId(august), "2026-08-31", owner.id, false);
    const rescheduled = await service.updateRecurringRule(
      ruleId(isolated),
      owner.id,
      changedSchedule,
      { scope: "future", occurrenceDate: "2026-03-31" },
    );
    assert.equal(rescheduled.purchaseDate, "2026-03-15");
    for (const month of ["03", "04", "05", "08", "12"]) {
      const rows = (await list(`2026-${month}`)).items.filter(
        (item) => item.name === "Agenda nova",
      );
      assert.equal(rows.length, 1);
      assert.equal(rows[0].purchaseDate, `2026-${month}-15`);
    }
    assert.deepEqual(
      historicalFields(await occurrence("2026-02", "Agenda editada")),
      beforeFebruary,
    );
    await assert.rejects(
      service.updateRecurringRule(
        ruleId(rescheduled),
        owner.id,
        { ...changedSchedule, purchaseDate: "2026-02-28" },
        { scope: "future", occurrenceDate: "2026-03-15" },
      ),
      { code: "RECURRING_SCHEDULE_OVERLAPS_HISTORY" },
    );
    await assert.rejects(
      service.updateRecurringRule(ruleId(rescheduled), other.id, changedSchedule, {
        scope: "future",
        occurrenceDate: "2026-03-15",
      }),
      { code: "RECURRING_RULE_NOT_FOUND" },
    );
    const may = await occurrence("2026-05", "Agenda nova");
    const weekly = await service.updateRecurringRule(
      ruleId(may),
      owner.id,
      { ...changedSchedule, purchaseDate: "2026-05-16", recurrenceFrequency: "weekly" },
      { scope: "future", occurrenceDate: "2026-05-15" },
    );
    assert.equal(weekly.recurrenceFrequency, "weekly");
    assert.deepEqual(
      (await list("2026-05")).items
        .filter((item) => item.name === "Agenda nova")
        .map((item) => item.purchaseDate)
        .sort(),
      ["2026-05-16", "2026-05-23", "2026-05-30"],
    );
    assert.equal((await occurrence("2026-04", "Agenda nova")).purchaseDate, "2026-04-15");

    // Credit-card recurrences use the same edit scopes and retain prior invoice allocation.
    const shoppingBase = {
      ...rescheduleBase,
      type: "expense" as const,
      name: "Shopping",
      paymentMethod: "credit_card" as const,
      categoryId: expenseCategory.id,
      accountId: null,
      cardId: card.id,
      isSettled: null,
    };
    const shopping = await service.createTransaction({ ...shoppingBase, userId: owner.id });
    const shoppingEdited = await service.updateRecurringRule(
      ruleId(shopping),
      owner.id,
      { ...shoppingBase, purchaseDate: "2026-03-31", amount: 1100 },
      { scope: "future", occurrenceDate: "2026-03-31" },
    );
    const oldCardOccurrence = await service.getRecurringRuleOccurrence(
      ruleId(shopping),
      "2026-02-28",
      owner.id,
    );
    await service.updateRecurringRule(
      ruleId(shoppingEdited),
      owner.id,
      { ...shoppingBase, purchaseDate: "2026-03-30", amount: 1100 },
      { scope: "future", occurrenceDate: "2026-03-31" },
    );
    assert.deepEqual(
      historicalFields(
        await service.getRecurringRuleOccurrence(ruleId(shopping), "2026-02-28", owner.id),
      ),
      historicalFields(oldCardOccurrence),
    );
    assert.equal((await occurrence("2026-04", "Shopping")).purchaseDate, "2026-03-30");

    const postponedBase = { ...rescheduleBase, name: "Agenda adiada" };
    const postponedFirst = await service.createTransaction({ ...postponedBase, userId: owner.id });
    const postponedSingle = await service.updateRecurringRule(
      ruleId(postponedFirst),
      owner.id,
      { ...postponedBase, purchaseDate: "2026-03-31" },
      { scope: "single", occurrenceDate: "2026-03-31" },
    );
    const postponed = await service.updateRecurringRule(
      ruleId(postponedSingle),
      owner.id,
      { ...postponedBase, purchaseDate: "2026-05-05" },
      { scope: "future", occurrenceDate: "2026-03-31" },
    );
    // The response must identify the version that actually owns the new date.
    assert.equal(
      (await service.getRecurringRuleOccurrence(ruleId(postponed), "2026-05-05", owner.id))
        .purchaseDate,
      "2026-05-05",
    );
    assert.equal(
      (await list("2026-04")).items.some((item) => item.name === "Agenda adiada"),
      false,
    );
    assert.equal((await occurrence("2026-06", "Agenda adiada")).purchaseDate, "2026-06-05");
  } finally {
    await applicationPool?.end();
    if (originalExternalUrl === undefined) delete process.env.EXTERNAL_DATABASE_URL;
    else process.env.EXTERNAL_DATABASE_URL = originalExternalUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    await admin.query(`DROP DATABASE "${databaseName}"`);
    await admin.end();
  }
});
