import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { invoicePaymentCategoryName } from "@openmonetis/domain/categories";
import {
  ListTransactionsQuerySchema,
  TransactionInputSchema,
} from "@openmonetis/validators/transactions";

test("settlements preserve planned values, cash dates, rateios, undo and recurrence deadlines", {
  skip: process.env.SETTLEMENTS_INTEGRATION_TEST !== "1",
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
  const databaseName = `openmonetis_settlements_test_${Date.now()}`;
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
    await db
      .insert(schema.tags)
      .values({ userId: owner.id, name: "Trabalho", nameKey: "trabalho" })
      .returning();
    const { dueDateRulesRepository } = await import("./due-date-rules.repository");
    const service = createTransactionsService(
      {
        ...transactions,
        dueDateRules: dueDateRulesRepository,
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
    const settlements = await import("./settlements.repository");
    const { eq, and } = await import("drizzle-orm");
    const [secondAccount] = await db
      .insert(schema.financialAccounts)
      .values({ userId: owner.id, name: "Second", type: "checking" })
      .returning();
    const [external] = await db
      .insert(schema.people)
      .values({ userId: owner.id, name: "Other person", role: "external" })
      .returning();
    const base = TransactionInputSchema.parse({
      type: "income",
      condition: "single",
      paymentMethod: "pix",
      name: "Income",
      amount: 1000,
      purchaseDate: "2026-09-10",
      personId: person.id,
      accountId: account.id,
      categoryId: category.id,
      isSettled: false,
      splitShares: [
        { personId: person.id, amount: 600 },
        { personId: external.id, amount: 400 },
      ],
    });
    const item = await service.createTransaction({ ...base, userId: owner.id });
    assert.ok(item.recordId);
    const id = item.recordId;
    await settlements.settlePersistedTransactions({
      ids: [id],
      userId: owner.id,
      isSettled: true,
      date: new Date("2026-08-31T00:00:00Z"),
      amount: 900.01,
      accountId: secondAccount.id,
    });
    const detail = await service.getTransactionById(id, owner.id);
    assert.equal(detail.displayAmount, 900.01);
    assert.equal(detail.plannedAmount, 1000);
    assert.equal(detail.settledDate, "2026-08-31");
    assert.equal(
      detail.splitShares.reduce((total, share) => total + Math.round(share.amount * 100), 0),
      90001,
    );
    assert.equal(
      (await db.select().from(schema.transactions).where(eq(schema.transactions.id, id)))[0].amount,
      "1000.00",
    );
    const accountsService = createAccountsService(accountsRepository);
    const augustAccounts = await accountsService.list(owner.id, "2026-08");
    assert.equal(
      augustAccounts.find((row) => row.id === secondAccount.id)?.summary.balance,
      540.01,
    );
    const augustStatement = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({
        period: "2026-08",
        view: "accountStatement",
        accountIds: secondAccount.id,
      }),
    );
    assert.ok(
      augustStatement.items.some((row) => row.recordId === id && row.settledDate === "2026-08-31"),
    );
    assert.deepEqual(
      await settlements.settlePersistedTransactions({
        ids: [id],
        userId: other.id,
        isSettled: false,
        date: new Date("2026-08-31T00:00:00Z"),
      }),
      [],
    );
    await assert.rejects(() =>
      settlements.settlePersistedTransactions({
        ids: [id],
        userId: owner.id,
        isSettled: true,
        date: new Date("2026-08-31T00:00:00Z"),
      }),
    );
    await assert.rejects(() => service.updateTransaction(id, owner.id, { amount: 800 }));
    await service.updateTransaction(id, owner.id, {
      name: "Renamed income",
      note: "Keep effective data",
    });
    const renamed = await service.getTransactionById(id, owner.id);
    assert.equal(renamed.settledDate, "2026-08-31");
    assert.equal(renamed.displayAmount, 900.01);
    assert.equal(
      renamed.splitShares.reduce((sum, share) => sum + Math.round(share.amount * 100), 0),
      90001,
    );

    await settlements.settlePersistedTransactions({
      ids: [id],
      userId: owner.id,
      isSettled: false,
      date: new Date("2026-09-01T00:00:00Z"),
    });
    const undone = await service.getTransactionById(id, owner.id);
    assert.equal(undone.displayAmount, 1000);
    assert.equal(undone.settledDate, null);
    assert.equal(undone.accountId, account.id);
    await service.updateTransaction(id, owner.id, { accountId: secondAccount.id });
    await settlements.settlePersistedTransactions({
      ids: [id],
      userId: owner.id,
      isSettled: false,
      date: new Date("2026-09-01T00:00:00Z"),
    });
    assert.equal((await service.getTransactionById(id, owner.id)).accountId, secondAccount.id);

    assert.equal(
      (
        await db
          .select()
          .from(schema.settlementEvents)
          .where(
            and(
              eq(schema.settlementEvents.userId, owner.id),
              eq(schema.settlementEvents.transactionId, id),
            ),
          )
      ).length,
      2,
    );
    const recurringItem = await service.createTransaction({
      ...base,
      userId: owner.id,
      condition: "recurring",
      recurrenceFrequency: "monthly",
      purchaseDate: "2026-07-10",
      splitShares: null,
    });
    assert.ok(recurringItem.recurringRuleId);
    const ruleId = recurringItem.recurringRuleId;
    await settlements.settleRecurringTransaction({
      id: ruleId,
      purchaseDate: new Date("2026-09-10T00:00:00Z"),
      userId: owner.id,
      isSettled: true,
      date: new Date("2026-08-30T00:00:00Z"),
      amount: 1200,
      accountId: secondAccount.id,
    });
    const september = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-09" }),
    );
    assert.equal(
      september.items.find((row) => row.recurringRuleId === ruleId)?.displayAmount,
      1200,
    );
    assert.equal(
      september.items.find((row) => row.recurringRuleId === ruleId)?.plannedAmount,
      1000,
    );
    const october = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-10" }),
    );
    assert.equal(october.items.find((row) => row.recurringRuleId === ruleId)?.displayAmount, 1000);
    assert.equal(
      (await accountsService.list(owner.id, "2026-08")).find((row) => row.id === secondAccount.id)
        ?.summary.balance,
      1200,
    );
    const recurringStatement = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({
        period: "2026-08",
        view: "accountStatement",
        accountIds: secondAccount.id,
      }),
    );
    assert.ok(
      recurringStatement.items.some(
        (row) => row.recurringRuleId === ruleId && row.purchaseDate === "2026-09-10",
      ),
    );
    const limited = await service.createTransaction({
      ...base,
      userId: owner.id,
      condition: "recurring",
      recurrenceFrequency: "monthly",
      purchaseDate: "2026-10-31",
      recurrenceEndDate: "2026-10-31",
      splitShares: null,
    });
    const afterDeadline = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-11" }),
    );
    assert.ok(!afterDeadline.items.some((row) => row.recurringRuleId === limited.recurringRuleId));
    const { createRecurringTransactionsService } = await import(
      "../services/recurring-transactions.service"
    );
    const report = await createRecurringTransactionsService(
      recurring.recurringTransactionsRepository,
      () => "2026-10-12",
    ).report({ type: "income" }, owner.id);
    // The base recurrence remains; the capped rule adds nothing after its deadline.
    assert.deepEqual(report.projections[1], { period: "2026-11", total: 1000 });
    const [expenseCategory] = await db
      .insert(schema.categories)
      .values({ userId: owner.id, name: "Expenses", type: "expense" })
      .returning();
    const expense = await service.createTransaction({
      ...base,
      userId: owner.id,
      type: "expense",
      categoryId: expenseCategory.id,
    });
    assert.ok(expense.recordId);
    await service.settleTransactions(
      [expense.recordId],
      owner.id,
      true,
      "2026-08-31",
      350.03,
      secondAccount.id,
    );
    const { budgetsRepository } = await import("./budgets.repository");
    const spending = await budgetsRepository.listSpendingEntries(owner.id, "2026-09");
    assert.equal(spending.find((row) => row.categoryId === expenseCategory.id)?.amount, "-210.02");
    const { createDashboardService } = await import("../services/dashboard.service");
    const { dashboardRepository } = await import("./dashboard.repository");
    assert.equal(
      (
        await createDashboardService(dashboardRepository, accountsService).getCategoryBreakdown(
          "2026-09",
          owner.id,
        )
      ).expensesTotal,
      210.02,
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
    app.route("/transactions", createTransactionsRoute(service));
    const request = (path: string, body: unknown) =>
      app.request(`http://test/transactions${path}`, {
        method: path === "/recurrence-preview" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    assert.equal(
      (await request("/recurrence-preview", { purchaseDate: "2026-10-31", frequency: "monthly" }))
        .status,
      404,
    );
    assert.equal(
      (await request("/settlement", { ids: [id], isSettled: true, settledAmount: -10 })).status,
      400,
    );
    const [foreignAccount] = await db
      .insert(schema.financialAccounts)
      .values({ userId: other.id, name: "Foreign", type: "checking" })
      .returning();
    assert.equal(
      (await request("/settlement", { ids: [id], isSettled: true, accountId: foreignAccount.id }))
        .status,
      404,
    );
    assert.equal(
      (await request("/settlement", { ids: [id], isSettled: true, settledDate: "2099-01-01" }))
        .status,
      400,
    );

    const concurrent = await service.createTransaction({
      ...base,
      userId: owner.id,
      splitShares: null,
    });
    assert.ok(concurrent.recordId);
    const attempts = await Promise.allSettled(
      [1, 2].map(() =>
        settlements.settlePersistedTransactions({
          ids: [concurrent.recordId as string],
          userId: owner.id,
          isSettled: true,
          date: new Date("2026-09-10T00:00:00Z"),
        }),
      ),
    );
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);

    const { billsRepository } = await import("./bills.repository");
    const { createBillsService } = await import("../services/bills.service");
    const { DashboardBillsOutputSchema } = await import("@openmonetis/validators/bills");
    const bills = createBillsService(billsRepository, () => "2026-07-15", dueDateRulesRepository);
    const payableBase = {
      ...base,
      type: "expense" as const,
      categoryId: expenseCategory.id,
      name: "Conta Pix",
      amount: 100,
      splitShares: null,
      purchaseDate: "2026-06-30",
      dueDate: "2026-07-10",
    };
    const pixBill = await service.createTransaction({ ...payableBase, userId: owner.id });
    for (const paymentMethod of [
      "debit_card",
      "boleto",
      "cash",
      "bank_transfer",
      "benefits",
    ] as const) {
      await service.createTransaction({
        ...payableBase,
        paymentMethod,
        name: `Conta ${paymentMethod}`,
        userId: owner.id,
      });
    }
    await service.createTransaction({
      ...payableBase,
      name: "Sem vencimento",
      dueDate: null,
      purchaseDate: "2026-07-10",
      userId: owner.id,
    });
    await service.createTransaction({
      ...base,
      name: "Receita com vencimento",
      splitShares: null,
      dueDate: "2026-07-10",
      userId: owner.id,
    });
    const [payableCard] = await db
      .insert(schema.cards)
      .values({
        userId: owner.id,
        accountId: account.id,
        name: "Card payables exclusion",
        closingDay: 20,
        dueDay: 28,
        limit: "10000",
      })
      .returning();
    await service.createTransaction({
      ...payableBase,
      name: "Compra no cartão",
      paymentMethod: "credit_card",
      cardId: payableCard.id,
      accountId: null,
      isSettled: null,
      userId: owner.id,
    });
    await service.createTransaction({
      ...payableBase,
      name: "Conta parcelada",
      condition: "installment",
      installmentCount: 3,
      amount: 300,
      userId: owner.id,
    });
    const monthlyBill = await service.createTransaction({
      ...payableBase,
      name: "Conta recorrente",
      condition: "recurring",
      recurrenceFrequency: "monthly",
      purchaseDate: "2026-06-15",
      dueDate: "2026-06-20",
      userId: owner.id,
    });
    await service.createTransaction({
      ...payableBase,
      name: "Conta semanal",
      condition: "recurring",
      recurrenceFrequency: "weekly",
      purchaseDate: "2026-07-04",
      dueDate: null,
      userId: owner.id,
    });
    const beforePayment = await bills.get("2026-07", owner.id);
    DashboardBillsOutputSchema.parse(beforePayment);
    assert.equal(beforePayment.items.length, 8);
    assert.equal(beforePayment.totalOpen, 800);
    assert.equal(beforePayment.overdueCount, 7);
    assert.deepEqual(
      beforePayment.items
        .filter((bill) => bill.name === "Conta semanal")
        .map((bill) => bill.dueDate),
      [],
    );
    const payableList = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-07", payables: "true", pageSize: 100 }),
      false,
    );
    assert.deepEqual(
      new Set(payableList.items.map((bill) => bill.id)),
      new Set(beforePayment.items.map((bill) => bill.id)),
    );
    assert.equal((await bills.get("2026-07", other.id)).items.length, 0);
    const pix = beforePayment.items.find((bill) => bill.recordId === pixBill.recordId);
    assert.ok(pix);
    assert.equal(pix.paymentMethod, "pix");
    assert.equal(pix.status, "overdue");
    await assert.rejects(
      bills.pay(
        "2026-07",
        { billId: pix.id, accountId: secondAccount.id, paidAt: "2026-07-09" },
        other.id,
      ),
      { code: "bill_not_found" },
    );
    await assert.rejects(
      bills.pay(
        "2026-07",
        { billId: pix.id, accountId: foreignAccount.id, paidAt: "2026-07-09" },
        owner.id,
      ),
      { code: "account_not_found" },
    );
    await bills.pay(
      "2026-07",
      { billId: pix.id, accountId: secondAccount.id, paidAt: "2026-07-09", amount: 92.5 },
      owner.id,
    );
    const afterPayment = await bills.get("2026-07", owner.id);
    const paidPix = afterPayment.items.find((bill) => bill.id === pix.id);
    assert.equal(paidPix?.amount, 92.5);
    assert.equal(paidPix?.settledDate, "2026-07-09");
    assert.equal(paidPix?.boletoPaymentDate, null);
    assert.equal(paidPix?.accountId, secondAccount.id);
    assert.equal(paidPix?.status, "paid");
    assert.equal(afterPayment.totalOpen, 700);
    assert.equal(afterPayment.items.at(-1)?.id, pix.id);
    const monthly = afterPayment.items.find(
      (bill) => bill.recurringRuleId === monthlyBill.recurringRuleId,
    );
    assert.ok(monthly);
    await bills.pay(
      "2026-07",
      { billId: monthly.id, accountId: account.id, paidAt: "2026-07-14", amount: 110 },
      owner.id,
    );
    const paidMonthly = (await bills.get("2026-07", owner.id)).items.find(
      (bill) => bill.id === monthly.id,
    );
    assert.equal(paidMonthly?.settledDate, "2026-07-14");
    assert.equal(paidMonthly?.amount, 110);
    const augustBills = await bills.get("2026-08", owner.id);
    assert.equal(augustBills.items.find((bill) => bill.name === "Conta recorrente")?.amount, 100);
    assert.equal(
      augustBills.items.find((bill) => bill.name === "Conta parcelada")?.dueDate,
      "2026-08-10",
    );

    // Global due-date rules: database ownership, conflicts, period boundaries and snapshots.
    const { createDueDateRulesService } = await import("../services/due-date-rules.service");
    const { defaultDueDateRules } = await import("@openmonetis/domain/due-date-rules");
    const settings = createDueDateRulesService(
      dueDateRulesRepository,
      async () => [],
      () => "2026-10-12",
    );
    const payableRule = {
      id: "10000000-0000-4000-8000-000000000011",
      name: "Boletos",
      target: "payable" as const,
      scope: "all" as const,
      cardIds: [],
      transactionIds: [],
      seriesIds: [],
      adjustment: "next" as const,
      weekends: true,
      holidays: true,
    };
    // Existing JSON rules are migrated without aliases in the runtime contract.
    const [legacyOwner] = await db
      .insert(schema.user)
      .values({ name: "Legacy calendar", email: "calendar@example.test" })
      .returning();
    const { sql } = await import("drizzle-orm");
    const { readFile } = await import("node:fs/promises");
    const legacyRules = [
      { ...payableRule, target: "boleto" },
      { ...payableRule, id: "10000000-0000-4000-8000-000000000012", target: "invoice" },
    ];
    const legacyCalendar = defaultDueDateRules("2026-10-12").calendar;
    await db.execute(
      sql`insert into due_date_rule_versions (user_id, revision, effective_from, calendar, rules) values (${legacyOwner.id}, 1, '2026-10-12', ${JSON.stringify(legacyCalendar)}::jsonb, ${JSON.stringify(legacyRules)}::jsonb)`,
    );
    await db.execute(
      sql.raw(
        await readFile(
          new URL(
            "../../../../packages/db/drizzle/0017_payable_due_date_rules.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      ),
    );
    const [migratedVersion] = await dueDateRulesRepository.listVersions(legacyOwner.id);
    assert.deepEqual(
      migratedVersion.rules,
      legacyRules.map((rule) => ({
        ...rule,
        target: rule.target === "boleto" ? "payable" : rule.target,
      })),
    );
    assert.equal(migratedVersion.revision, 1);
    assert.deepEqual(migratedVersion.calendar, legacyCalendar);
    const config = await settings.save(
      { ...defaultDueDateRules("2026-10-12"), rules: [payableRule] },
      owner.id,
    );
    assert.equal((await settings.get(other.id)).revision, 0);
    await assert.rejects(
      settings.save(
        { ...config, rules: [{ ...payableRule, scope: "selected", transactionIds: [id] }] },
        other.id,
      ),
      { code: "DUE_DATE_RULES_STALE" },
    );
    await assert.rejects(
      settings.save(
        {
          ...config,
          rules: [payableRule, { ...payableRule, id: "10000000-0000-4000-8000-000000000012" }],
        },
        owner.id,
      ),
      { code: "DUE_DATE_RULE_CONFLICT" },
    );
    for (const paymentMethod of [
      "pix",
      "debit_card",
      "cash",
      "bank_transfer",
      "benefits",
    ] as const) {
      const payable = await service.createTransaction({
        ...payableBase,
        paymentMethod,
        name: `Conta ajustada ${paymentMethod}`,
        purchaseDate: "2026-10-01",
        dueDate: "2026-10-31",
        userId: owner.id,
      });
      assert.ok(payable.recordId);
      assert.equal(payable.dueDate, "2026-11-03");
      assert.equal(payable.dueDateExceptionEditable, true);
      assert.ok(
        (await settings.options(owner.id)).payables.some((row) => row.id === payable.recordId),
      );
      const exception = {
        target: "transaction" as const,
        transactionId: payable.recordId,
        excluded: true,
      };
      await settings.setException(exception, owner.id);
      assert.equal(
        (await service.getTransactionById(payable.recordId, owner.id)).dueDate,
        "2026-10-31",
      );
      await settings.setException({ ...exception, excluded: false }, owner.id);
      const adjustedBill = (await bills.get("2026-11", owner.id)).items.find(
        (row) => row.recordId === payable.recordId,
      );
      assert.equal(adjustedBill?.dueDate, "2026-11-03");
      assert.equal(
        adjustedBill?.dueDateAdjustment?.reasons.at(-1)?.nationalHolidayId,
        "allSoulsDay",
      );
      const payableList = await service.listTransactions(
        owner.id,
        ListTransactionsQuerySchema.parse({ period: "2026-11", payables: "true", pageSize: 100 }),
        false,
      );
      assert.ok(payableList.items.some((row) => row.recordId === payable.recordId));
      await service.settleTransactions([payable.recordId], owner.id, true, "2026-10-12");
      await assert.rejects(settings.setException(exception, owner.id), {
        code: "DUE_DATE_EXCEPTION_SETTLED",
      });
      assert.equal(
        (await service.getTransactionById(payable.recordId, owner.id)).dueDate,
        "2026-11-03",
      );
    }
    const shifted = await service.createTransaction({
      ...payableBase,
      paymentMethod: "boleto",
      purchaseDate: "2026-10-01",
      dueDate: "2026-10-31",
      name: "Boleto ajustado",
      userId: owner.id,
    });
    assert.equal(shifted.dueDate, "2026-11-03");
    assert.equal(shifted.originalDueDate, "2026-10-31");
    assert.ok(shifted.recordId);
    const transactionException = {
      target: "transaction" as const,
      transactionId: shifted.recordId,
      excluded: true,
    };
    await assert.rejects(settings.setException(transactionException, other.id), {
      code: "DUE_DATE_RULE_TARGET_UNAVAILABLE",
    });
    await settings.setException(transactionException, owner.id);
    const restored = await service.getTransactionById(shifted.recordId, owner.id);
    assert.equal(restored.dueDate, "2026-10-31");
    assert.equal(restored.dueDateRuleExcluded, true);
    assert.equal(restored.dueDateAdjustment, null);
    assert.ok(
      (await bills.get("2026-10", owner.id)).items.some((row) => row.recordId === shifted.recordId),
    );
    await settings.setException({ ...transactionException, excluded: false }, owner.id);
    assert.equal(
      (await service.getTransactionById(shifted.recordId, owner.id)).dueDateAdjustment?.reasons.at(
        -1,
      )?.nationalHolidayId,
      "allSoulsDay",
    );

    assert.equal(
      (await service.getTransactionById(shifted.recordId, owner.id)).dueDate,
      "2026-11-03",
    );
    const novemberPayables = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-11", payables: "true", pageSize: 100 }),
      false,
    );
    assert.ok(novemberPayables.items.some((row) => row.recordId === shifted.recordId));
    assert.ok(
      (await bills.get("2026-11", owner.id)).items.some((row) => row.recordId === shifted.recordId),
    );
    assert.ok(
      !(await bills.get("2026-10", owner.id)).items.some(
        (row) => row.recordId === shifted.recordId,
      ),
    );
    const exceptional = await service.createTransaction({
      ...payableBase,
      paymentMethod: "boleto",
      purchaseDate: "2026-10-01",
      dueDate: "2026-10-31",
      dueDateRuleExcluded: true,
      name: "Boleto sem ajuste",
      userId: owner.id,
    });
    assert.equal(exceptional.dueDate, "2026-10-31");
    const monthlyShifted = await service.createTransaction({
      ...payableBase,
      paymentMethod: "pix",
      condition: "recurring",
      recurrenceFrequency: "monthly",
      purchaseDate: "2026-10-31",
      dueDate: "2026-10-31",
      name: "Recorrência ajustada",
      userId: owner.id,
    });
    assert.ok(monthlyShifted.recurringRuleId);
    const recurringException = {
      target: "recurring" as const,
      recurringRuleId: monthlyShifted.recurringRuleId,
      occurrenceDate: "2026-10-31",
      excluded: true,
    };
    await assert.rejects(
      settings.setException({ ...recurringException, occurrenceDate: "2026-10-30" }, owner.id),
      { code: "INVALID_RECURRING_OCCURRENCE" },
    );
    await assert.rejects(settings.setException(recurringException, other.id), {
      code: "DUE_DATE_RULE_TARGET_UNAVAILABLE",
    });
    await settings.setException(recurringException, owner.id);
    const occurrenceException = await service.getRecurringRuleOccurrence(
      monthlyShifted.recurringRuleId,
      "2026-10-31",
      owner.id,
    );
    assert.equal(occurrenceException.dueDate, "2026-10-31");
    assert.equal(occurrenceException.dueDateRuleExcluded, true);
    assert.equal(
      (
        await service.getRecurringRuleOccurrence(
          monthlyShifted.recurringRuleId,
          "2026-11-30",
          owner.id,
        )
      ).dueDateRuleExcluded,
      false,
    );
    const restoredBill = (await bills.get("2026-10", owner.id)).items.find(
      (row) => row.recurringRuleId === monthlyShifted.recurringRuleId,
    );
    assert.equal(restoredBill?.dueDate, "2026-10-31");
    await settings.setException({ ...recurringException, excluded: false }, owner.id);

    await service.settleTransactions([shifted.recordId], owner.id, true, "2026-10-12");
    await assert.rejects(settings.setException(transactionException, owner.id), {
      code: "DUE_DATE_EXCEPTION_SETTLED",
    });

    await service.settleRecurringOccurrence(
      monthlyShifted.recurringRuleId,
      "2026-10-31",
      owner.id,
      true,
      "2026-10-12",
    );
    const [frozenOccurrence] = await db
      .select({ frozenDueDate: schema.recurringTransactionOccurrences.frozenDueDate })
      .from(schema.recurringTransactionOccurrences)
      .where(
        and(
          eq(schema.recurringTransactionOccurrences.userId, owner.id),
          eq(
            schema.recurringTransactionOccurrences.recurringRuleId,
            monthlyShifted.recurringRuleId,
          ),
        ),
      );
    assert.equal(
      frozenOccurrence.frozenDueDate?.toISOString().slice(0, 10),
      "2026-11-03",
      "recurring settlement must freeze the adjusted date in the database",
    );
    const rawRecurringRule = await transactions.findRecurringRuleByIdForUser(
      monthlyShifted.recurringRuleId,
      owner.id,
    );
    assert.ok(rawRecurringRule);
    const readOccurrence = await transactions.listRecurringOccurrencesForUser(
      [rawRecurringRule.seriesId],
      new Date("2026-10-31T00:00:00Z"),
      new Date("2026-10-31T00:00:00Z"),
      owner.id,
    );
    assert.equal(readOccurrence.length, 1, "recurring state should be found by reference date");
    assert.equal(readOccurrence[0].frozenDueDate?.toISOString().slice(0, 10), "2026-11-03");
    assert.equal(
      readOccurrence[0].dueDateAdjustment?.reasons.at(-1)?.nationalHolidayId,
      "allSoulsDay",
    );
    await assert.rejects(settings.setException(recurringException, owner.id), {
      code: "DUE_DATE_EXCEPTION_SETTLED",
    });

    await settings.save({ ...config, rules: [{ ...payableRule, adjustment: "none" }] }, owner.id);
    assert.equal(
      (await service.getTransactionById(shifted.recordId, owner.id)).dueDate,
      "2026-11-03",
    );
    assert.equal(
      (
        await service.getRecurringRuleOccurrence(
          monthlyShifted.recurringRuleId,
          "2026-10-31",
          owner.id,
        )
      ).dueDate,
      "2026-11-03",
    );
    await service.settleTransactions([shifted.recordId], owner.id, false);
    assert.equal(
      (await service.getTransactionById(shifted.recordId, owner.id)).dueDate,
      "2026-10-31",
    );
    // A future invoice uses selected-card rules and keeps its cycle closing date.
    const { invoicesRepository } = await import("./invoices.repository");
    const { createInvoicesService } = await import("../services/invoices.service");
    const invoices = createInvoicesService(
      invoicesRepository,
      () => "2026-10-12",
      dueDateRulesRepository,
    );
    const [selectedCard] = await db
      .insert(schema.cards)
      .values({
        userId: owner.id,
        accountId: account.id,
        name: "Cartão selecionado",
        closingDay: 20,
        dueDay: 31,
        limit: "10000",
      })
      .returning();
    await service.createTransaction({
      ...payableBase,
      paymentMethod: "credit_card",
      cardId: selectedCard.id,
      accountId: null,
      purchaseDate: "2026-10-10",
      isSettled: null,
      userId: owner.id,
    });
    const beforeRules = (await invoices.get("2026-10", owner.id)).items.find(
      (row) => row.cardId === selectedCard.id,
    );
    assert.ok(beforeRules);
    assert.equal(beforeRules.dueDate, "2026-11-03");
    assert.equal(beforeRules.dueDateExceptionEditable, true);
    const invoiceException = {
      target: "invoice" as const,
      cardId: selectedCard.id,
      period: "2026-10",
      excluded: true,
    };
    await assert.rejects(settings.setException(invoiceException, other.id), {
      code: "DUE_DATE_RULE_TARGET_UNAVAILABLE",
    });
    await settings.setException(invoiceException, owner.id);
    const restoredInvoice = (await invoices.get("2026-10", owner.id)).items.find(
      (row) => row.cardId === selectedCard.id,
    );
    assert.equal(restoredInvoice?.dueDate, "2026-10-31");
    assert.equal(restoredInvoice?.closingDate, beforeRules.closingDate);
    await settings.setException({ ...invoiceException, excluded: false }, owner.id);
    assert.equal(
      (await invoices.get("2026-10", owner.id)).items.find((row) => row.cardId === selectedCard.id)
        ?.dueDate,
      "2026-11-03",
    );

    const latest = await settings.get(owner.id);
    await assert.rejects(
      settings.save(
        {
          ...latest,
          rules: [
            {
              ...payableRule,
              target: "invoice",
              scope: "selected",
              cardIds: ["10000000-0000-4000-8000-000000000099"],
            },
          ],
        },
        owner.id,
      ),
      { code: "DUE_DATE_RULE_TARGET_UNAVAILABLE" },
    );
    const invoiceConfig = await settings.save(
      {
        ...latest,
        rules: [
          { ...payableRule, target: "invoice", scope: "selected", cardIds: [selectedCard.id] },
        ],
      },
      owner.id,
    );
    const afterRules = (await invoices.get("2026-10", owner.id)).items.find(
      (row) => row.cardId === selectedCard.id,
    );
    assert.equal(afterRules?.dueDate, "2026-11-03");
    assert.equal(afterRules?.originalDueDate, "2026-10-31");
    assert.equal(afterRules?.closingDate, beforeRules.closingDate);
    await db.insert(schema.categories).values({
      userId: owner.id,
      name: invoicePaymentCategoryName,
      type: "expense",
      isSystem: true,
    });
    // A concurrent exception change must invalidate the payment snapshot.
    const concurrentInvoices = createInvoicesService(
      {
        ...invoicesRepository,
        insertPayment: async (draft) => {
          await settings.setException(invoiceException, owner.id);
          return invoicesRepository.insertPayment(draft);
        },
      },
      () => "2026-10-12",
      dueDateRulesRepository,
    );
    await assert.rejects(
      concurrentInvoices.pay(
        selectedCard.id,
        "2026-10",
        {
          accountId: account.id,
          paidAt: "2026-10-12",
          allocations: [{ personId: person.id, amount: 40 }],
        },
        owner.id,
      ),
      { code: "invoice_payment_conflict" },
    );
    assert.equal(
      (await invoices.get("2026-10", owner.id)).items.find((row) => row.cardId === selectedCard.id)
        ?.paidAmount,
      0,
    );
    await settings.setException({ ...invoiceException, excluded: false }, owner.id);
    await invoices.pay(
      selectedCard.id,
      "2026-10",
      {
        accountId: account.id,
        paidAt: "2026-10-12",
        allocations: [{ personId: person.id, amount: 40 }],
      },
      owner.id,
    );
    await assert.rejects(
      invoices.updateDates(
        selectedCard.id,
        "2026-10",
        {
          closingDate: "2026-10-20",
          dueDate: "2026-10-31",
        },
        owner.id,
      ),
      { code: "DUE_DATE_EXCEPTION_SETTLED" },
    );
    await assert.rejects(settings.setException(invoiceException, owner.id), {
      code: "DUE_DATE_EXCEPTION_SETTLED",
    });
    assert.equal(
      (await invoices.get("2026-10", owner.id)).items.find((row) => row.cardId === selectedCard.id)
        ?.dueDateExceptionEditable,
      false,
    );
    await invoices.pay(
      selectedCard.id,
      "2026-10",
      {
        accountId: account.id,
        paidAt: "2026-10-12",
        allocations: [{ personId: person.id, amount: 60 }],
      },
      owner.id,
    );
    await settings.save({ ...invoiceConfig, rules: [] }, owner.id);
    const paidInvoice = (await invoices.get("2026-10", owner.id)).items.find(
      (row) => row.cardId === selectedCard.id,
    );
    assert.equal(paidInvoice?.dueDate, "2026-11-03");
    assert.equal(paidInvoice?.originalDueDate, "2026-10-31");
    assert.equal(paidInvoice?.dueDateAdjustment?.reasons.at(-1)?.nationalHolidayId, "allSoulsDay");

    // Person totals and settlements use the same invoice month for recurring card shares.
    const [invoicePerson] = await db
      .insert(schema.people)
      .values({ userId: owner.id, name: "Invoice person", role: "external" })
      .returning();
    const [recurringCard] = await db
      .insert(schema.cards)
      .values({
        userId: owner.id,
        accountId: account.id,
        name: "Recurring card",
        limit: "10000",
        closingDay: 4,
        closingDayPurchasesNextInvoice: true,
        dueDay: 11,
      })
      .returning();
    await service.createTransaction({
      ...base,
      userId: owner.id,
      type: "expense",
      paymentMethod: "credit_card",
      cardId: recurringCard.id,
      accountId: null,
      categoryId: expenseCategory.id,
      personId: invoicePerson.id,
      amount: 4243.4,
      purchaseDate: "2026-09-23",
      splitShares: [],
    });
    for (const purchaseDate of ["2026-09-23", "2026-10-23"]) {
      await service.createTransaction({
        ...base,
        userId: owner.id,
        type: "expense",
        condition: "recurring",
        paymentMethod: "credit_card",
        cardId: recurringCard.id,
        accountId: null,
        categoryId: expenseCategory.id,
        amount: 40.9,
        purchaseDate,
        recurrenceFrequency: "monthly",
        recurrenceEndDate: purchaseDate === "2026-09-23" ? purchaseDate : null,
        splitShares: [
          { personId: person.id, amount: 13.5 },
          { personId: invoicePerson.id, amount: 27.4 },
        ],
      });
    }
    const { personSettlementsRepository } = await import("./person-settlements.repository");
    const { createPersonSettlementsService } = await import(
      "../services/person-settlements.service"
    );
    const { createPeopleService } = await import("../services/people.service");
    const personSettlementsService = createPersonSettlementsService(personSettlementsRepository);
    const peopleService = createPeopleService(people.peopleRepository, {
      list: service.listTransactions,
    });
    const personOctober = await peopleService.getFinancialSummary(
      invoicePerson.id,
      owner.id,
      "2026-10",
    );
    const settlementsOctober = await personSettlementsService.getSnapshot(
      invoicePerson.id,
      owner.id,
      "2026-10",
    );
    const settlementsNovember = await personSettlementsService.getSnapshot(
      invoicePerson.id,
      owner.id,
      "2026-11",
    );
    const summaryOctober = await personSettlementsService.getSummary(owner.id, "2026-10");
    assert.equal(personOctober.totalExpenses, 4270.8);
    assert.equal(settlementsOctober.balance.assignedAmount, personOctober.totalExpenses);
    assert.equal(settlementsNovember.balance.assignedAmount, 27.4);
    assert.equal(
      summaryOctober.items.find((item) => item.personId === invoicePerson.id)?.balance
        .assignedAmount,
      4270.8,
    );
    assert.deepEqual(
      await personSettlementsRepository.listRecurringBalanceRulesForPeriod(other.id, "2026-10"),
      [],
    );
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
