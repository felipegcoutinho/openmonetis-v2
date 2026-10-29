import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { otherExpenseCategoryName, otherIncomeCategoryName } from "@openmonetis/domain/categories";
import type {
  TransactionOutput,
  TransactionRefundOutput,
} from "@openmonetis/validators/transactions";
import { withIntegrationDatabase } from "./test-support/integration-database";

type Identity = {
  id: string;
  cookie: string;
  personId: string;
  incomeCategoryId: string;
  expenseCategoryId: string;
};
type Account = { id: string; summary: { balance: number } };

test("assembled API protects financial endpoints and persists transfers and refunds", {
  skip: process.env.TRANSACTIONS_INTEGRATION_TEST !== "1",
}, async (t) => {
  await withIntegrationDatabase(async () => {
    const { app } = await import("./app");
    const { db, ...schema } = await import("@openmonetis/db");
    const { and, eq } = await import("drizzle-orm");
    const period = "2020-01";
    const date = "2020-01-10";
    const refundDate = "2020-01-20";

    function request(path: string, identity?: Identity, method = "GET", body?: unknown) {
      return app.request(`http://localhost:7001${path}`, {
        method,
        headers: {
          origin: "http://localhost:7002",
          ...(body === undefined ? {} : { "content-type": "application/json" }),
          ...(identity ? { cookie: identity.cookie } : {}),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }

    async function data<T>(response: Response, status = 200): Promise<T> {
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      assert.equal(body.error, null);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.doesNotMatch(
        JSON.stringify(body),
        /"(?:userId|password|digest|tokenDigest|stack)"\s*:/,
      );
      return body.data;
    }

    async function error(response: Response, status: number, code?: string) {
      const body = await response.json();
      assert.equal(response.status, status, JSON.stringify(body));
      assert.equal(body.error, true);
      if (code) assert.equal(body.code, code);
      assert.equal(response.headers.get("cache-control"), "private, no-store");
      assert.doesNotMatch(JSON.stringify(body), /"(?:userId|password|digest|stack)"\s*:/);
    }

    async function register(): Promise<Identity> {
      const response = await request("/api/auth/sign-up/email", undefined, "POST", {
        name: "Test user",
        email: `${randomUUID()}@example.test`,
        password: "integration-test-password-123",
      });
      assert.equal(response.status, 200, await response.clone().text());
      const body = await response.json();
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";", 1)[0])
        .join("; ");
      assert.ok(cookie);
      const [person] = await db
        .select()
        .from(schema.people)
        .where(and(eq(schema.people.userId, body.user.id), eq(schema.people.role, "admin")));
      const categories = await db
        .select()
        .from(schema.categories)
        .where(eq(schema.categories.userId, body.user.id));
      const income = categories.find((category) => category.name === otherIncomeCategoryName);
      const expense = categories.find((category) => category.name === otherExpenseCategoryName);
      assert.ok(person);
      assert.ok(income);
      assert.ok(expense);
      return {
        id: body.user.id,
        cookie,
        personId: person.id,
        incomeCategoryId: income.id,
        expenseCategoryId: expense.id,
      };
    }

    const owner = await register();
    const stranger = await register();

    async function fixture(identity = owner, funding = 100) {
      const source = await data<Account>(
        await request("/accounts", identity, "POST", {
          name: `Source ${randomUUID()}`,
          type: "checking",
        }),
        201,
      );
      const destination = await data<Account>(
        await request("/accounts", identity, "POST", {
          name: `Destination ${randomUUID()}`,
          type: "checking",
        }),
        201,
      );
      if (funding > 0)
        await data(
          await request("/transactions", identity, "POST", {
            type: "income",
            paymentMethod: "pix",
            name: "Funding",
            amount: funding,
            purchaseDate: date,
            personId: identity.personId,
            categoryId: identity.incomeCategoryId,
            accountId: source.id,
            isSettled: true,
            settledDate: date,
          }),
          201,
        );
      return {
        source,
        destination,
        transfer: {
          type: "transfer",
          paymentMethod: "bank_transfer",
          name: "Transfer",
          amount: 30.01,
          purchaseDate: date,
          personId: identity.personId,
          sourceAccountId: source.id,
          destinationAccountId: destination.id,
          isSettled: true,
        },
        expense: {
          type: "expense",
          paymentMethod: "pix",
          name: "Purchase",
          amount: 10.01,
          purchaseDate: date,
          personId: identity.personId,
          accountId: source.id,
          categoryId: identity.expenseCategoryId,
          isSettled: true,
          settledDate: date,
        },
      };
    }

    async function balances(identity: Identity, ...ids: string[]) {
      const accounts = await data<Account[]>(await request(`/accounts?period=${period}`, identity));
      return ids.map((id) => {
        const account = accounts.find((item) => item.id === id);
        assert.ok(account);
        return account.summary.balance;
      });
    }

    async function persistedTransferId(recordId: string | null) {
      assert.ok(recordId);
      const [row] = await db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.id, recordId));
      assert.ok(row?.transferId);
      return row.transferId;
    }

    async function transferRows(transferId: string) {
      return db
        .select()
        .from(schema.transactions)
        .where(eq(schema.transactions.transferId, transferId));
    }

    await t.test(
      "every documented private operation rejects requests without a session or device token",
      async (t) => {
        const response = await request("/openapi.json");
        assert.equal(response.status, 200);
        const document = await response.json();
        assert.ok(document.paths["/transactions"]?.post);
        const publicPaths = new Set(["/health", "/api/health", "/auth-config"]);
        for (const [path, operations] of Object.entries(
          document.paths as Record<string, Record<string, unknown>>,
        )) {
          if (publicPaths.has(path)) continue;
          for (const method of Object.keys(operations).filter((method) =>
            ["get", "post", "put", "patch", "delete"].includes(method),
          )) {
            await t.test(`${method.toUpperCase()} ${path}`, async () => {
              const url = path.replace(/\{[^}]+\}/g, "00000000-0000-4000-8000-000000000001");
              const result = await request(
                url,
                undefined,
                method.toUpperCase(),
                method === "get" ? undefined : {},
              );
              assert.equal(result.status, 401, await result.clone().text());
              assert.equal(result.headers.get("cache-control"), "private, no-store");
            });
          }
        }
      },
    );

    await t.test(
      "transfers persist two opposite postings and preserve the combined balance",
      async () => {
        const f = await fixture();
        const transfer = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", f.transfer),
          201,
        );
        const transferId = await persistedTransferId(transfer.recordId);
        const rows = await transferRows(transferId);
        assert.equal(rows.length, 2);
        assert.deepEqual(
          rows.map((row) => [row.accountId, row.amount]).sort(),
          [
            [f.source.id, "-30.01"],
            [f.destination.id, "30.01"],
          ].sort(),
        );
        assert.equal(
          rows.reduce((total, row) => total + Math.round(Number(row.amount) * 100), 0),
          0,
        );
        assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [69.99, 30.01]);
      },
    );

    await t.test(
      "insufficient balance and identical accounts reject transfers without partial writes",
      async () => {
        const f = await fixture();
        const before = await db
          .select()
          .from(schema.transactions)
          .where(eq(schema.transactions.accountId, f.source.id));
        await error(
          await request("/transactions", owner, "POST", { ...f.transfer, amount: 100.01 }),
          400,
          "INSUFFICIENT_TRANSFER_BALANCE",
        );
        await error(
          await request("/transactions", owner, "POST", {
            ...f.transfer,
            destinationAccountId: f.source.id,
          }),
          400,
        );
        assert.deepEqual(
          await db
            .select()
            .from(schema.transactions)
            .where(eq(schema.transactions.accountId, f.source.id)),
          before,
        );
        assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [100, 0]);
      },
    );

    await t.test(
      "pending transfers do not move cash and settlement validates the available balance",
      async () => {
        const f = await fixture(owner, 0);
        const transfer = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", { ...f.transfer, isSettled: false }),
          201,
        );
        assert.ok(transfer.recordId);
        const transferId = await persistedTransferId(transfer.recordId);
        assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [0, 0]);
        await error(
          await request("/transactions/settlement", owner, "PATCH", {
            ids: [transfer.recordId],
            isSettled: true,
          }),
          400,
          "INSUFFICIENT_TRANSFER_BALANCE",
        );
        assert.deepEqual(
          (await transferRows(transferId)).map((row) => row.isSettled),
          [false, false],
        );
      },
    );

    await t.test("editing and deleting a transfer update or remove both postings", async () => {
      const f = await fixture();
      const transfer = await data<TransactionOutput>(
        await request("/transactions", owner, "POST", f.transfer),
        201,
      );
      assert.ok(transfer.recordId);
      const transferId = await persistedTransferId(transfer.recordId);
      await data(
        await request(`/transactions/${transfer.recordId}`, owner, "PATCH", { amount: 40.01 }),
      );
      assert.deepEqual((await transferRows(transferId)).map((row) => row.amount).sort(), [
        "-40.01",
        "40.01",
      ]);
      assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [59.99, 40.01]);
      await error(
        await request(`/transactions/${transfer.recordId}`, owner, "PATCH", { amount: 100.01 }),
        400,
        "INSUFFICIENT_TRANSFER_BALANCE",
      );
      assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [59.99, 40.01]);
      await data(await request(`/transactions/${transfer.recordId}`, owner, "DELETE"));
      assert.deepEqual(await transferRows(transferId), []);
      assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [100, 0]);
    });

    await t.test("concurrent transfers cannot spend the same available balance twice", async () => {
      const f = await fixture();
      const outcomes = await Promise.all([
        request("/transactions", owner, "POST", { ...f.transfer, amount: 80 }),
        request("/transactions", owner, "POST", { ...f.transfer, amount: 80 }),
      ]);
      assert.deepEqual(outcomes.map((response) => response.status).sort(), [201, 400]);
      await error(
        outcomes.find((response) => response.status === 400) as Response,
        400,
        "INSUFFICIENT_TRANSFER_BALANCE",
      );
      const rows = await db
        .select()
        .from(schema.transactions)
        .where(
          and(
            eq(schema.transactions.type, "transfer"),
            eq(schema.transactions.sourceAccountId, f.source.id),
          ),
        );
      assert.equal(rows.length, 2);
      assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [20, 80]);
    });

    await t.test(
      "foreign transfer accounts are rejected in both directions without moving either user's cash",
      async () => {
        const f = await fixture();
        const foreign = await fixture(stranger);
        await error(
          await request("/transactions", owner, "POST", {
            ...f.transfer,
            sourceAccountId: foreign.source.id,
          }),
          404,
          "SOURCE_ACCOUNT_NOT_FOUND",
        );
        await error(
          await request("/transactions", owner, "POST", {
            ...f.transfer,
            destinationAccountId: foreign.destination.id,
          }),
          404,
          "DESTINATION_ACCOUNT_NOT_FOUND",
        );
        assert.deepEqual(await balances(owner, f.source.id, f.destination.id), [100, 0]);
        assert.deepEqual(
          await balances(stranger, foreign.source.id, foreign.destination.id),
          [100, 0],
        );
      },
    );

    await t.test(
      "another session cannot read, edit, delete, refund or settle an owned transaction",
      async () => {
        const f = await fixture();
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", f.expense),
          201,
        );
        assert.ok(source.recordId);
        const path = `/transactions/${source.recordId}`;
        await error(await request(path, stranger), 404, "TRANSACTION_NOT_FOUND");
        await error(
          await request(path, stranger, "PATCH", { amount: 1 }),
          404,
          "TRANSACTION_NOT_FOUND",
        );
        await error(await request(path, stranger, "DELETE"), 404, "TRANSACTION_NOT_FOUND");
        await error(
          await request(`${path}/refunds`, stranger, "POST", { amount: 1, receivedAt: refundDate }),
          404,
          "TRANSACTION_NOT_FOUND",
        );
        await error(
          await request("/transactions/settlement", stranger, "PATCH", {
            ids: [source.recordId],
            isSettled: false,
          }),
          404,
          "TRANSACTION_NOT_FOUND",
        );
        const current = await data<TransactionOutput>(await request(path, owner));
        assert.equal(current.displayAmount, 10.01);
        assert.equal(current.isSettled, true);
        const listing = await data<{ items: TransactionOutput[] }>(
          await request(`/transactions?period=${period}`, stranger),
        );
        assert.ok(listing.items.every((row) => row.recordId !== source.recordId));
      },
    );

    await t.test(
      "foreign person, category, account and split participants are rejected before creating an expense",
      async () => {
        const f = await fixture();
        const foreign = await fixture(stranger);
        for (const [patch, code] of [
          [{ personId: stranger.personId }, "PERSON_NOT_FOUND"],
          [{ categoryId: stranger.expenseCategoryId }, "CATEGORY_NOT_FOUND"],
          [{ accountId: foreign.source.id }, "ACCOUNT_NOT_FOUND"],
          [
            {
              splitShares: [
                { personId: owner.personId, amount: 6 },
                { personId: stranger.personId, amount: 4.01 },
              ],
            },
            "SPLIT_PERSON_NOT_FOUND",
          ],
        ] as const)
          await error(
            await request("/transactions", owner, "POST", { ...f.expense, ...patch }),
            404,
            code,
          );
        assert.deepEqual(await balances(owner, f.source.id), [100]);
      },
    );

    await t.test(
      "partial and final refunds preserve the purchase and cannot exceed its original amount",
      async () => {
        const f = await fixture();
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", f.expense),
          201,
        );
        assert.ok(source.recordId);
        const path = `/transactions/${source.recordId}`;
        const partial = await data<TransactionRefundOutput>(
          await request(`${path}/refunds`, owner, "POST", { amount: 3.33, receivedAt: refundDate }),
          201,
        );
        assert.equal(partial.remainingRefundableAmount, 6.68);
        assert.deepEqual(await balances(owner, f.source.id), [93.32]);
        await error(
          await request(`${path}/refunds`, owner, "POST", { amount: 6.69, receivedAt: refundDate }),
          400,
          "INVALID_REFUND_AMOUNT",
        );
        const final = await data<TransactionRefundOutput>(
          await request(`${path}/refunds`, owner, "POST", { amount: 6.68, receivedAt: refundDate }),
          201,
        );
        assert.equal(final.remainingRefundableAmount, 0);
        const detail = await data<TransactionOutput>(await request(path, owner));
        assert.equal(detail.plannedAmount, 10.01);
        assert.equal(detail.refundedAmount, 10.01);
        assert.equal(detail.refundableAmount, 0);
        assert.deepEqual(await balances(owner, f.source.id), [100]);
        await error(
          await request(`${path}/refunds`, owner, "POST", { amount: 0.01, receivedAt: refundDate }),
          400,
          "INVALID_REFUND_AMOUNT",
        );
      },
    );

    await t.test(
      "refunds persist exact proportional allocations and inherit the purchase tags",
      async () => {
        const f = await fixture();
        const external = await data<{ id: string }>(
          await request("/people", owner, "POST", { name: "External" }),
          201,
        );
        const tag = await data<{ id: string }>(
          await request("/tags", owner, "POST", { name: `Refund ${randomUUID()}` }),
          201,
        );
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", {
            ...f.expense,
            tagIds: [tag.id],
            splitShares: [
              { personId: owner.personId, amount: 6 },
              { personId: external.id, amount: 4.01 },
            ],
          }),
          201,
        );
        const refund = await data<TransactionRefundOutput>(
          await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
            amount: 3.33,
            receivedAt: refundDate,
          }),
          201,
        );
        const detail = await data<TransactionOutput>(
          await request(`/transactions/${refund.id}`, owner),
        );
        assert.deepEqual(
          detail.splitShares.map((share) => [share.personId, share.amount]).sort(),
          [
            [owner.personId, 1.99],
            [external.id, 1.34],
          ].sort(),
        );
        assert.equal(
          detail.splitShares.reduce((total, share) => total + Math.round(share.amount * 100), 0),
          333,
        );
        assert.deepEqual(detail.tagIds, [tag.id]);
        assert.deepEqual(await balances(owner, f.source.id), [95.99]);
      },
    );

    await t.test(
      "concurrent refunds cannot exceed the purchase and create no orphan credits",
      async () => {
        const f = await fixture();
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", f.expense),
          201,
        );
        const outcomes = await Promise.all([
          request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
            amount: 8,
            receivedAt: refundDate,
          }),
          request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
            amount: 8,
            receivedAt: refundDate,
          }),
        ]);
        assert.equal(outcomes.filter((response) => response.status === 201).length, 1);
        const rejected = outcomes.find((response) => response.status !== 201);
        assert.ok(rejected);
        assert.ok([400, 409].includes(rejected.status));
        await error(rejected, rejected.status);
        const links = await db
          .select()
          .from(schema.transactionRefunds)
          .where(eq(schema.transactionRefunds.sourceTransactionId, source.recordId as string));
        assert.equal(links.length, 1);
        assert.equal(links[0].amount, "8.00");
        const credits = await db
          .select()
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.accountId, f.source.id),
              eq(schema.transactions.origin, "refund"),
            ),
          );
        assert.equal(credits.length, 1);
        assert.deepEqual(await balances(owner, f.source.id), [97.99]);
      },
    );

    await t.test(
      "deleting a refund restores its available amount and a refunded purchase cannot be deleted first",
      async () => {
        const f = await fixture();
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", f.expense),
          201,
        );
        const refund = await data<TransactionRefundOutput>(
          await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
            amount: 10.01,
            receivedAt: refundDate,
          }),
          201,
        );
        await error(
          await request(`/transactions/${source.recordId}`, owner, "DELETE"),
          400,
          "TRANSACTION_HAS_REFUNDS",
        );
        await data(await request(`/transactions/${refund.id}`, owner, "DELETE"));
        const detail = await data<TransactionOutput>(
          await request(`/transactions/${source.recordId}`, owner),
        );
        assert.equal(detail.refundedAmount, 0);
        assert.equal(detail.refundableAmount, 10.01);
        assert.deepEqual(await balances(owner, f.source.id), [89.99]);
        assert.deepEqual(
          await db
            .select()
            .from(schema.transactionRefunds)
            .where(eq(schema.transactionRefunds.sourceTransactionId, source.recordId as string)),
          [],
        );
        await data(await request(`/transactions/${source.recordId}`, owner, "DELETE"));
        assert.deepEqual(await balances(owner, f.source.id), [100]);
      },
    );

    await t.test(
      "refunds reject invalid amounts, future dates and ineligible income without credits",
      async () => {
        const f = await fixture();
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", f.expense),
          201,
        );
        for (const amount of [0, -1, 0.001])
          await error(
            await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
              amount,
              receivedAt: refundDate,
            }),
            400,
          );
        await error(
          await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
            amount: 1,
            receivedAt: "2999-01-01",
          }),
          400,
          "REFUND_DATE_FUTURE",
        );
        const income = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", {
            ...f.expense,
            type: "income",
            categoryId: owner.incomeCategoryId,
          }),
          201,
        );
        await error(
          await request(`/transactions/${income.recordId}/refunds`, owner, "POST", {
            amount: 1,
            receivedAt: refundDate,
          }),
          400,
          "TRANSACTION_NOT_REFUNDABLE",
        );
        assert.deepEqual(await balances(owner, f.source.id), [100]);
      },
    );

    await t.test("card refunds require an invoice period and reject a paid invoice", async () => {
      const f = await fixture();
      const card = await data<{ id: string }>(
        await request("/cards", owner, "POST", {
          accountId: f.source.id,
          name: "Card",
          brand: "visa",
          closingDay: 20,
          dueDay: 25,
          limit: 1000,
        }),
        201,
      );
      const source = await data<TransactionOutput>(
        await request("/transactions", owner, "POST", {
          ...f.expense,
          paymentMethod: "credit_card",
          accountId: null,
          cardId: card.id,
          invoicePeriod: period,
        }),
        201,
      );
      await error(
        await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
          amount: 1,
          receivedAt: refundDate,
        }),
        400,
        "REFUND_INVOICE_REQUIRED",
      );
      await data(
        await request(`/invoices/${card.id}/${period}/payments`, owner, "POST", {
          accountId: f.source.id,
          paidAt: refundDate,
          allocations: [{ personId: owner.personId, amount: 10.01 }],
        }),
        201,
      );
      await error(
        await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
          amount: 1,
          receivedAt: refundDate,
          invoicePeriod: period,
        }),
        400,
        "INVOICE_ALREADY_PAID",
      );
      const detail = await data<TransactionOutput>(
        await request(`/transactions/${source.recordId}`, owner),
      );
      assert.equal(detail.refundedAmount, 0);
    });

    await t.test(
      "card refunds credit an open invoice without depositing money into the account",
      async () => {
        const f = await fixture();
        const card = await data<{ id: string }>(
          await request("/cards", owner, "POST", {
            accountId: f.source.id,
            name: "Open card",
            brand: "visa",
            closingDay: 20,
            dueDay: 25,
            limit: 1000,
          }),
          201,
        );
        const source = await data<TransactionOutput>(
          await request("/transactions", owner, "POST", {
            ...f.expense,
            paymentMethod: "credit_card",
            accountId: null,
            cardId: card.id,
            invoicePeriod: period,
          }),
          201,
        );
        const refund = await data<TransactionRefundOutput>(
          await request(`/transactions/${source.recordId}/refunds`, owner, "POST", {
            amount: 3.33,
            receivedAt: refundDate,
            invoicePeriod: period,
          }),
          201,
        );
        const detail = await data<TransactionOutput>(
          await request(`/transactions/${refund.id}`, owner),
        );
        assert.equal(detail.period, period);
        assert.equal(detail.cardId, card.id);
        assert.equal(detail.accountId, null);
        assert.equal(detail.origin, "refund");
        assert.deepEqual(await balances(owner, f.source.id), [100]);
      },
    );

    await t.test(
      "bulk actions categorize, rename, tag and delete only owned eligible records",
      async () => {
        const f = await fixture(owner, 0);
        const create = async (name: string) =>
          data<TransactionOutput>(
            await request("/transactions", owner, "POST", {
              ...f.expense,
              name,
              isSettled: false,
              settledDate: undefined,
            }),
            201,
          );
        const first = await create("Bulk first");
        const second = await create("Bulk second");
        const ids = [first.recordId, second.recordId] as string[];
        const tag = await data<{ id: string }>(
          await request("/tags", owner, "POST", { name: `Bulk ${randomUUID()}` }),
          201,
        );
        const [leisure] = await db
          .select()
          .from(schema.categories)
          .where(and(eq(schema.categories.userId, owner.id), eq(schema.categories.name, "Viagem")));
        assert.ok(leisure);

        await error(
          await request("/transactions/bulk/category", stranger, "PATCH", {
            ids,
            categoryId: stranger.expenseCategoryId,
          }),
          404,
          "TRANSACTION_NOT_FOUND",
        );
        await error(
          await request("/transactions/bulk/category", owner, "PATCH", {
            ids,
            categoryId: owner.incomeCategoryId,
          }),
          400,
          "BULK_CATEGORY_INCOMPATIBLE",
        );
        assert.deepEqual(
          await data(
            await request("/transactions/bulk/category", owner, "PATCH", {
              ids,
              categoryId: leisure.id,
            }),
          ),
          { ids },
        );
        await data(
          await request("/transactions/bulk/tags", owner, "PATCH", {
            ids,
            operation: "add",
            tagIds: [tag.id],
          }),
        );
        await data(
          await request("/transactions/bulk/tags", owner, "PATCH", {
            ids,
            operation: "add",
            tagIds: [tag.id],
          }),
        );
        for (const id of ids) {
          const detail = await data<TransactionOutput>(await request(`/transactions/${id}`, owner));
          assert.equal(detail.categoryId, leisure.id);
          assert.deepEqual(detail.tagIds, [tag.id]);
        }
        await data(
          await request("/transactions/bulk/tags", owner, "PATCH", {
            ids: [first.recordId],
            operation: "remove",
            tagIds: [tag.id],
          }),
        );
        const untagged = await data<TransactionOutput>(
          await request(`/transactions/${first.recordId}`, owner),
        );
        assert.deepEqual(untagged.tagIds, []);

        await error(
          await request("/transactions/bulk/names", stranger, "PATCH", {
            items: [{ id: ids[0], name: "Stolen" }],
          }),
          404,
          "TRANSACTION_NOT_FOUND",
        );
        await data(
          await request("/transactions/bulk/names", owner, "PATCH", {
            items: [
              { id: ids[0], name: "  Mercado  " },
              { id: ids[1], name: "Farmácia" },
            ],
          }),
        );
        const names = await Promise.all(
          ids.map(
            async (id) =>
              (await data<TransactionOutput>(await request(`/transactions/${id}`, owner))).name,
          ),
        );
        assert.deepEqual(names, ["Mercado", "Farmácia"]);

        await error(
          await request("/transactions/bulk/delete", stranger, "POST", { ids }),
          404,
          "TRANSACTION_NOT_FOUND",
        );
        assert.deepEqual(
          await data(await request("/transactions/bulk/delete", owner, "POST", { ids })),
          { ids },
        );
        const remaining = await db
          .select()
          .from(schema.transactions)
          .where(
            and(
              eq(schema.transactions.userId, owner.id),
              eq(schema.transactions.id, ids[0] as string),
            ),
          );
        assert.deepEqual(remaining, []);
      },
    );

    await t.test("a forged session cookie cannot authenticate a financial request", async () => {
      await error(
        await request("/accounts", {
          ...owner,
          cookie: "better-auth.session_token=forged-session.invalid-signature",
        }),
        401,
        "unauthorized",
      );
    });

    await t.test(
      "signing out revokes access even if the old signed cookie is replayed",
      async () => {
        const response = await request("/api/auth/sign-out", stranger, "POST", {});
        assert.equal(response.status, 200);
        await error(await request("/accounts", stranger), 401, "unauthorized");
      },
    );
  });
});
