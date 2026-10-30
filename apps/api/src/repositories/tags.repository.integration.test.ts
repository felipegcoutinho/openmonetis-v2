import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { internalTransferCategoryName } from "@openmonetis/domain/categories";
import {
  ListTransactionsQuerySchema,
  TransactionInputSchema,
  UpdateRecurringRuleQuerySchema,
} from "@openmonetis/validators/transactions";

// Opt-in: uses the configured development PostgreSQL server, creating and dropping
// a dedicated database. Existing databases and financial records are untouched.
test("tags persist across transaction and recurring scopes with database ownership", {
  skip: process.env.TAGS_INTEGRATION_TEST !== "1",
}, async () => {
  const require = createRequire(new URL("../../../../packages/db/package.json", import.meta.url));
  require("dotenv").config({
    path: new URL("../../../../.env", import.meta.url).pathname,
    quiet: true,
  });
  const { Pool } = require("pg");
  const { migrate } = require("drizzle-orm/node-postgres/migrator");
  const { resolveDatabaseUrl } = await import("../../../../packages/db/src/database-url");
  assert.notEqual(process.env.NODE_ENV, "production", "Integration tests require development mode");
  const connectionUrl = new URL(process.env.TEST_DATABASE_URL ?? resolveDatabaseUrl());
  const admin = new Pool({ connectionString: connectionUrl.toString() });
  const databaseName = `openmonetis_tags_test_${Date.now()}`;
  const originalExternalUrl = process.env.EXTERNAL_DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  let applicationPool: { end(): Promise<void> } | undefined;
  await admin.query(`CREATE DATABASE "${databaseName}"`);
  try {
    connectionUrl.pathname = `/${databaseName}`;
    process.env.NODE_ENV = "test";
    process.env.EXTERNAL_DATABASE_URL = connectionUrl.toString();
    const { db, pool } = await import("@openmonetis/db");
    applicationPool = pool;
    await migrate(db, {
      migrationsFolder: new URL("../../../../packages/db/drizzle", import.meta.url).pathname,
    });
    const schema = await import("@openmonetis/db/schema");
    const transactions = await import("./transactions.repository");
    const tags = await import("./tags.repository");
    const accounts = await import("./accounts.repository");
    const cards = await import("./cards.repository");
    const categories = await import("./categories.repository");
    const people = await import("./people.repository");
    const { recurringExpensesRepository } = await import("./recurring-expenses.repository");
    const { createTransactionsService } = await import("../services/transactions.service");
    const { createTagsService } = await import("../services/tags.service");
    const [owner, stranger] = await db
      .insert(schema.user)
      .values([
        { name: "Owner", email: "owner@example.test" },
        { name: "Stranger", email: "stranger@example.test" },
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
      .values({ userId: owner.id, name: "Test", type: "expense" })
      .returning();
    const service = createTransactionsService(
      {
        ...transactions,
        transitionRecurringRuleForUser: (await import("./recurring-transactions.repository"))
          .transitionRecurringRuleForUser,
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
    const tagService = createTagsService(
      tags.tagsRepository,
      async (userId, period) =>
        (
          await service.listTransactions(
            userId,
            ListTransactionsQuerySchema.parse({ period }),
            false,
          )
        ).items,
    );
    const first = await tagService.create({ name: "Viagem", color: "neutral" }, owner.id);
    const second = await tagService.create({ name: "Negócio", color: "neutral" }, owner.id);
    const foreign = await tagService.create({ name: "Viagem", color: "neutral" }, stranger.id);
    await assert.rejects(
      () => tagService.create({ name: "  VIAGEM ", color: "neutral" }, owner.id),
      {
        code: "tag_name_conflict",
      },
    );
    assert.equal((await tagService.list(stranger.id)).length, 1);
    await assert.rejects(() => tagService.update(first.id, { name: "Other" }, stranger.id), {
      code: "tag_not_found",
    });
    const base = {
      type: "expense",
      paymentMethod: "pix",
      name: "Single",
      amount: 100,
      purchaseDate: "2026-10-10",
      personId: person.id,
      accountId: account.id,
      categoryId: category.id,
      tagIds: [first.id, second.id],
    };
    const single = await service.createTransaction({
      ...TransactionInputSchema.parse(base),
      userId: owner.id,
    });
    assert.deepEqual(new Set(single.tagIds), new Set(base.tagIds));
    const filtered = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-10", tagIds: base.tagIds.join(",") }),
    );
    assert.equal(filtered.total, 1);
    assert.equal(filtered.items.length, 1);
    await assert.rejects(() =>
      db
        .insert(schema.transactionTags)
        .values({ userId: owner.id, transactionId: single.recordId as string, tagId: foreign.id }),
    );
    const copy = await service.copyTransaction(single.recordId as string, owner.id);
    assert.deepEqual(new Set(copy.tagIds), new Set(base.tagIds));
    await service.deleteTransaction(copy.recordId as string, owner.id);

    const installment = await service.createTransaction({
      ...TransactionInputSchema.parse({
        ...base,
        condition: "installment",
        amount: 300,
        installmentCount: 3,
        tagIds: [first.id],
      }),
      userId: owner.id,
    });
    const series = await transactions.listTransactionSeriesForUser(
      installment.seriesId as string,
      owner.id,
    );
    assert.equal(series.length, 3);
    const loadInstallmentTags = async () =>
      Promise.all(
        series.map(
          async (row) => (await transactions.findTransactionByIdForUser(row.id, owner.id))?.tagIds,
        ),
      );
    assert.deepEqual(await loadInstallmentTags(), [[first.id], [first.id], [first.id]]);
    await service.updateTransaction(series[1].id, owner.id, { tagIds: [second.id] });
    assert.equal(
      (await transactions.findTransactionByIdForUser(series[1].id, owner.id))?.period,
      "2026-11",
    );
    await service.updateTransaction(series[0].id, owner.id, { name: "Renamed series" }, "series");
    assert.deepEqual(await loadInstallmentTags(), [[first.id], [second.id], [first.id]]);
    await service.updateTransaction(series[1].id, owner.id, { tagIds: [] }, "future");
    assert.deepEqual(await loadInstallmentTags(), [[first.id], [], []]);

    const recurringInput = TransactionInputSchema.parse({
      ...base,
      name: "Recurring",
      condition: "recurring",
      recurrenceFrequency: "monthly",
      amount: 50,
      tagIds: [first.id],
    });
    const recurring = await service.createTransaction({ ...recurringInput, userId: owner.id });
    const recurringCopy = await service.copyRecurringRule(
      recurring.recurringRuleId as string,
      owner.id,
    );
    assert.deepEqual(recurringCopy.tagIds, [first.id]);
    // Stop the copied series from its first occurrence; later stops intentionally keep history.
    await service.changeRecurringRuleStatus(
      recurringCopy.recurringRuleId as string,
      owner.id,
      "cancelled",
      "2026-10-10",
    );
    const november = await service.updateRecurringRule(
      recurring.recurringRuleId as string,
      owner.id,
      { ...recurringInput, purchaseDate: "2026-11-10", tagIds: [second.id] },
      UpdateRecurringRuleQuerySchema.parse({ scope: "single", occurrenceDate: "2026-11-10" }),
    );
    await service.updateRecurringRule(november.recurringRuleId as string, owner.id, {
      ...recurringInput,
      name: "Renamed recurring",
      purchaseDate: "2026-11-10",
      tagIds: undefined,
    });
    for (const [period, expected] of [
      ["2026-10", first.id],
      ["2026-11", second.id],
      ["2026-12", first.id],
    ]) {
      const result = await service.listTransactions(
        owner.id,
        ListTransactionsQuerySchema.parse({ period, condition: "recurring" }),
      );
      assert.equal(result.items.length, 1);
      assert.deepEqual(result.items[0].tagIds, [expected]);
    }
    const [destination] = await db
      .insert(schema.financialAccounts)
      .values({ userId: owner.id, name: "Destination", type: "checking" })
      .returning();
    await db.insert(schema.categories).values({
      userId: owner.id,
      name: internalTransferCategoryName,
      type: "income",
      isSystem: true,
    });
    const [fundingCategory] = await db
      .insert(schema.categories)
      .values({ userId: owner.id, name: "Funding", type: "income" })
      .returning();
    await service.createTransaction({
      ...TransactionInputSchema.parse({
        type: "income",
        paymentMethod: "pix",
        name: "Transfer funding",
        personId: person.id,
        categoryId: fundingCategory.id,
        accountId: account.id,
        amount: 1000,
        purchaseDate: "2026-09-01",
        settledDate: "2026-09-01",
        isSettled: true,
      }),
      userId: owner.id,
    });
    for (const [amount, isSettled] of [
      [287.15, true],
      [163.08, false],
    ] as const) {
      await service.createTransaction({
        ...TransactionInputSchema.parse({
          type: "transfer",
          paymentMethod: "bank_transfer",
          name: "Tagged transfer",
          personId: person.id,
          amount,
          isSettled,
          purchaseDate: "2026-10-16",
          sourceAccountId: account.id,
          destinationAccountId: destination.id,
          tagIds: [first.id, second.id],
        }),
        userId: owner.id,
      });
    }
    const report = await tagService.report("2026-10", owner.id);
    assert.equal(report.items.find((row) => row.tagId === first.id)?.expenses, 250);
    assert.equal(report.items.find((row) => row.tagId === second.id)?.expenses, 100);
    assert.deepEqual(
      report.items.find((row) => row.tagId === first.id),
      {
        tagId: first.id,
        income: 0,
        expenses: 250,
        transfers: 450.23,
        balance: -250,
        transactionCount: 5,
      },
    );
    assert.deepEqual(
      report.items.find((row) => row.tagId === second.id),
      {
        tagId: second.id,
        income: 0,
        expenses: 100,
        transfers: 450.23,
        balance: -100,
        transactionCount: 3,
      },
    );
    assert.ok(
      (await tagService.report("2026-11", owner.id)).items.every((row) => row.transfers === 0),
    );
    assert.equal((await tagService.report("2026-10", stranger.id)).items[0].transfers, 0);
    const december = (
      await service.listTransactions(
        owner.id,
        ListTransactionsQuerySchema.parse({ period: "2026-12", condition: "recurring" }),
      )
    ).items[0];
    const january = await service.updateRecurringRule(
      december.recurringRuleId as string,
      owner.id,
      { ...recurringInput, purchaseDate: "2027-01-10", tagIds: [second.id] },
      UpdateRecurringRuleQuerySchema.parse({ scope: "future", occurrenceDate: "2027-01-10" }),
    );
    assert.deepEqual(january.tagIds, [second.id]);
    const unchangedDecember = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-12", condition: "recurring" }),
    );
    assert.deepEqual(unchangedDecember.items[0].tagIds, [first.id]);
    await recurringExpensesRepository.versionForUser({
      id: january.recurringRuleId as string,
      userId: owner.id,
      mode: "pause",
      effectiveDate: "2027-01-10",
      nextDate: null,
    });
    const decemberRule = await transactions.findRecurringRuleByIdForUser(
      december.recurringRuleId as string,
      owner.id,
    );
    assert.ok(decemberRule);
    const ruleVersions = await transactions.listRecurringRulesBySeriesForUser(
      decemberRule.seriesId,
      owner.id,
    );
    const paused = (
      await Promise.all(
        ruleVersions.map((rule) => transactions.findRecurringRuleByIdForUser(rule.id, owner.id)),
      )
    ).find((rule) => rule?.status === "paused");
    assert.ok(paused);
    assert.deepEqual(paused.tagIds, [second.id]);
    await service.createTransaction({
      ...TransactionInputSchema.parse({ ...base, name: "Untagged single", tagIds: [] }),
      userId: owner.id,
    });
    await service.createTransaction({
      ...recurringInput,
      name: "Untagged recurring",
      tagIds: [],
      userId: owner.id,
    });
    const untagged = await service.listTransactions(
      owner.id,
      ListTransactionsQuerySchema.parse({ period: "2026-10", withoutTags: "true" }),
    );
    assert.equal(
      untagged.total,
      2,
      JSON.stringify(
        untagged.items.map((item) => ({
          name: item.name,
          period: item.period,
          condition: item.condition,
        })),
      ),
    );
    assert.ok(untagged.items.every((item) => item.tagIds?.length === 0));
    assert.ok(untagged.items.some((item) => item.isRecurring));
    await tagService.remove(first.id, owner.id);
    const remainingSingle = await transactions.findTransactionByIdForUser(
      single.recordId as string,
      owner.id,
    );
    assert.deepEqual(remainingSingle?.tagIds, [second.id]);
    assert.equal(remainingSingle?.amount, "-100.00");
    assert.equal((await tagService.list(stranger.id)).length, 1);
  } finally {
    await applicationPool?.end();
    if (originalExternalUrl === undefined) delete process.env.EXTERNAL_DATABASE_URL;
    else process.env.EXTERNAL_DATABASE_URL = originalExternalUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    try {
      await admin.query(`DROP DATABASE "${databaseName}"`);
    } finally {
      await admin.end();
    }
  }
});
