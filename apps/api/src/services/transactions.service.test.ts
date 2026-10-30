import assert from "node:assert/strict";
import test from "node:test";
import { RecurringTransitionError } from "@openmonetis/domain/recurring-transactions";
import { SettlementError } from "@openmonetis/domain/settlements";
import { InsufficientTransferBalanceError } from "@openmonetis/domain/transactions";
import {
  ExportTransactionsQuerySchema,
  InstallmentOptionsOutputSchema,
  ListTransactionsQuerySchema,
  RecurrenceEndDateOutputSchema,
  type TransactionInput,
  TransactionInputSchema,
  UpdateRecurringRuleQuerySchema,
} from "@openmonetis/validators/transactions";
import ExcelJS from "exceljs";
import { Hono } from "hono";
import type {
  RecurringRuleWithRelations,
  TransactionWithRelations,
} from "../repositories/transactions.repository";
import { createTransactionsRoute } from "../routes/transactions";
import type { ApiVariables } from "../types/context";
import { createTransactionsExport } from "../utils/transactions-export";
import {
  createTransactionsService,
  type TransactionsServiceDependencies,
} from "./transactions.service";

const userId = "10000000-0000-4000-8000-000000000001";
const transactionId = "20000000-0000-4000-8000-000000000002";
const firstPersonId = "30000000-0000-4000-8000-000000000003";
const secondPersonId = "40000000-0000-4000-8000-000000000004";
const recurringRuleId = "70000000-0000-4000-8000-000000000007";

function regularInput(patch: Partial<TransactionInput> = {}): TransactionInput {
  return TransactionInputSchema.parse({
    type: "expense",
    condition: "single",
    paymentMethod: "pix",
    name: "Purchase",
    amount: 100,
    purchaseDate: "2026-09-01",
    personId: firstPersonId,
    accountId: "50000000-0000-4000-8000-000000000005",
    categoryId: "60000000-0000-4000-8000-000000000006",
    isSettled: false,
    ...patch,
  });
}

function persistedTransaction(source: TransactionWithRelations) {
  return {
    ...source,
    tagIds: source.tagIds ?? [],
    plannedAmount: source.plannedAmount ?? source.amount,
    settledAmount: source.settledAmount ?? null,
    settledDate: source.settledDate ?? null,
    dueDateRuleExcluded: source.dueDateRuleExcluded ?? false,
    frozenDueDate: source.frozenDueDate ?? null,
    dueDateAdjustment: source.dueDateAdjustment ?? null,
    categoryName: source.categoryName ?? "Category",
  };
}

function transferFixture(isSettled = true) {
  const sourceAccountId = "50000000-0000-4000-8000-000000000005";
  const destinationAccountId = "90000000-0000-4000-8000-000000000009";
  const f = copyFixture({
    type: "transfer",
    paymentMethod: "bank_transfer",
    sourceAccountId,
    destinationAccountId,
    transferId: "b0000000-0000-4000-8000-00000000000b",
    isSettled,
  });
  const transfers: Parameters<TransactionsServiceDependencies["insertTransferWithBalanceCheck"]>[] =
    [];
  const snapshots: unknown[][] = [];
  Object.assign(f.dependencies, {
    findAdminPersonByUserId: async () => ({ id: firstPersonId, status: "active" }),
    findSystemCategoryByNameForUser: async () => ({ id: f.source.categoryId, type: "expense" }),
    getAccountBalanceSnapshotForUser: async (...args: unknown[]) => {
      snapshots.push(args);
      return { displayed: 500, persisted: 450 };
    },
    insertTransferWithBalanceCheck: async (
      ...args: Parameters<TransactionsServiceDependencies["insertTransferWithBalanceCheck"]>
    ) => {
      transfers.push(args);
      return args[0].map((record, index) => ({
        ...f.source,
        ...record,
        id: index === 0 ? transactionId : destinationAccountId,
      }));
    },
  });
  return {
    ...f,
    transfers,
    snapshots,
    get service() {
      return f.service;
    },
    input: regularInput({
      type: "transfer",
      paymentMethod: "bank_transfer",
      accountId: null,
      categoryId: null,
      sourceAccountId,
      destinationAccountId,
      isSettled,
    }),
  };
}

for (const settled of [false, true]) {
  test(`creating a ${settled ? "settled" : "pending"} transfer conserves both postings and uses the appropriate balance snapshot`, async () => {
    const f = transferFixture(settled);
    const result = await f.service.createTransaction({ ...f.input, userId });
    const [records, period, snapshot] = f.transfers[0];
    assert.equal(result.recordId, transactionId);
    assert.deepEqual(
      records.map((r) => [r.accountId, r.amount, r.userId]),
      [
        [f.input.sourceAccountId, "-100.00", userId],
        [f.input.destinationAccountId, "100.00", userId],
      ],
    );
    assert.ok(records[0].transferId);
    assert.equal(records[0].transferId, records[1].transferId);
    assert.equal(Number(records[0].amount) + Number(records[1].amount), 0);
    assert.match(period, /^\d{4}-\d{2}$/);
    assert.deepEqual(
      snapshot,
      settled ? { displayed: 500, persisted: 450 } : { displayed: 0, persisted: 0 },
    );
    assert.equal(f.snapshots.length, settled ? 1 : 0);
  });
}

for (const [failure, code] of [
  [new InsufficientTransferBalanceError(), "INSUFFICIENT_TRANSFER_BALANCE"],
  [new SettlementError("INVALID_SETTLEMENT_ALLOCATION"), "INVALID_SETTLEMENT_ALLOCATION"],
  [new RecurringTransitionError(), "INVALID_RECURRING_TRANSITION"],
] as const) {
  test(`transfer creation translates ${code} without retry`, async () => {
    const f = transferFixture();
    let attempts = 0;
    f.dependencies.insertTransferWithBalanceCheck = async () => {
      attempts++;
      throw failure;
    };
    await assert.rejects(f.service.createTransaction({ ...f.input, userId }), {
      code,
      status: 400,
    });
    assert.equal(attempts, 1);
  });
}

for (const kind of ["single", "installment", "transfer"] as const) {
  for (const source of ["regular", "inbox", "externalExpense"] as const) {
    test(`${kind} creation handles a missing insert result from ${source}`, async () => {
      const f = kind === "transfer" ? transferFixture(false) : copyFixture();
      const input =
        kind === "transfer"
          ? transferFixture(false).input
          : regularInput({
              condition: kind,
              ...(kind === "installment" ? { installmentCount: 3 } : {}),
            });
      f.dependencies.insertTransactionsWithSplits = async () => [];
      f.dependencies.insertInstallmentSeriesWithTransactions = async () => [];
      f.dependencies.insertTransferWithBalanceCheck = async () => [];
      const promise =
        source === "regular"
          ? f.service.createTransaction({ ...input, userId })
          : source === "inbox"
            ? f.service.createTransactionFromInbox(
                input,
                userId,
                "inbox-item",
                new Date("2026-09-01"),
              )
            : f.service.createTransactionFromExternalExpense(
                input,
                userId,
                "external-item",
                4,
                new Date("2026-09-01"),
              );
      await assert.rejects(promise, {
        code:
          source === "regular"
            ? kind === "transfer"
              ? "TRANSFER_TRANSACTION_NOT_FOUND"
              : "TRANSACTION_NOT_FOUND"
            : source === "inbox"
              ? "inbox_item_state_conflict"
              : "external_expense_state_conflict",
      });
    });
  }
}

test("source confirmation metadata reaches the write with owner and expected version", async () => {
  const f = copyFixture();
  const confirmedAt = new Date("2026-09-01");
  await f.service.createTransactionFromExternalExpense(
    regularInput(),
    userId,
    "external-item",
    7,
    confirmedAt,
  );
  assert.deepEqual(f.writes[0][2], {
    source: "externalExpense",
    sourceId: "external-item",
    expectedVersion: 7,
    confirmedAt,
    userId,
    installmentAmounts: undefined,
  });
  await f.service.createTransactionFromInbox(regularInput(), userId, "inbox-item", confirmedAt);
  assert.deepEqual(f.writes[1][2], {
    source: "inbox",
    sourceId: "inbox-item",
    confirmedAt,
    userId,
  });
});

for (const [label, method, result, input, code] of [
  ["inactive person", "findPersonByIdForUser", { status: "inactive" }, {}, "PERSON_NOT_FOUND"],
  ["wrong category type", "findCategoryByIdForUser", { type: "income" }, {}, "CATEGORY_NOT_FOUND"],
  ["archived account", "findAccountByIdForUser", { isArchived: true }, {}, "ACCOUNT_NOT_FOUND"],
  [
    "archived source",
    "findAccountByIdForUser",
    { isArchived: true },
    { sourceAccountId: "90000000-0000-4000-8000-000000000009" },
    "SOURCE_ACCOUNT_NOT_FOUND",
  ],
  [
    "inactive card",
    "findCardByIdForUser",
    { status: "inactive" },
    {
      accountId: null,
      cardId: "80000000-0000-4000-8000-000000000008",
      paymentMethod: "credit_card",
    },
    "CARD_NOT_FOUND",
  ],
  [
    "missing split participant",
    "findPersonByIdForUser",
    null,
    {
      splitShares: [
        { personId: firstPersonId, amount: 60 },
        { personId: secondPersonId, amount: 40 },
      ],
    },
    "SPLIT_PERSON_NOT_FOUND",
  ],
] as Array<
  [string, keyof TransactionsServiceDependencies, unknown, Partial<TransactionInput>, string]
>) {
  test(`transaction creation rejects ${label} without inserting`, async () => {
    const f = copyFixture();
    const original = f.dependencies.findPersonByIdForUser;
    Object.assign(f.dependencies, {
      [method]: async (id: string) =>
        method === "findPersonByIdForUser" &&
        label === "missing split participant" &&
        id === firstPersonId
          ? original(id, userId)
          : result,
    });
    if (label === "archived source")
      Object.assign(f.dependencies, {
        findAccountByIdForUser: async (id: string) => ({
          id,
          isArchived: id !== regularInput().accountId,
        }),
      });
    await assert.rejects(f.service.createTransaction({ ...regularInput(input), userId }), { code });
    assert.deepEqual(f.writes, []);
  });
}

for (const [field, code] of [
  ["settledDate", "SETTLEMENT_DATE_FUTURE"],
  ["boletoPaymentDate", "BOLETO_PAYMENT_DATE_FUTURE"],
] as const) {
  test(`future ${field} rejects transaction creation without writes`, async () => {
    const f = copyFixture();
    await assert.rejects(
      f.service.createTransaction({ ...regularInput(), [field]: "2999-01-01", userId }),
      { code },
    );
    assert.deepEqual(f.writes, []);
  });
}

function importFixture() {
  const f = copyFixture();
  const batches: Parameters<TransactionsServiceDependencies["insertImportedTransactions"]>[] = [];
  Object.assign(f.dependencies, {
    listPeopleByIdsForUser: async (ids: string[], owner: string) => {
      assert.equal(owner, userId);
      return ids.map((id) => ({ id, status: "active" }));
    },
    listCategoriesByIdsForUser: async (ids: string[], owner: string) => {
      assert.equal(owner, userId);
      return ids.map((id) => ({ id, type: "expense", name: "Food", isSystem: false }));
    },
    listImportedExternalIdsForUser: async () => [],
    listImportCategoryMappingsForUser: async () => [],
    insertImportedTransactions: async (
      ...args: Parameters<TransactionsServiceDependencies["insertImportedTransactions"]>
    ) => {
      batches.push(args);
      return args[0].map((r) => ({ ...f.source, ...r }));
    },
  });
  const input: Parameters<typeof f.service.importTransactions>[0] = {
    destinationType: "account",
    destinationId: f.source.accountId as string,
    paymentMethod: "pix",
    sourceFingerprint: "a".repeat(64),
    rows: [
      {
        externalId: "purchase-1",
        name: "  Mercado  ",
        amount: 10.01,
        type: "expense",
        purchaseDate: "2026-09-01",
        personId: firstPersonId,
        categoryId: f.source.categoryId as string,
      },
    ],
  };
  return {
    ...f,
    batches,
    input,
    get service() {
      return f.service;
    },
  };
}

test("account import signs amounts, scopes mappings and reports concurrent deduplication", async () => {
  const f = importFixture();
  f.input.rows.push({ ...f.input.rows[0], externalId: "purchase-2", amount: 20.02 });
  const insert = f.dependencies.insertImportedTransactions;
  f.dependencies.insertImportedTransactions = async (...args) =>
    (await insert(...args)).slice(0, 1);
  const output = await f.service.importTransactions(f.input, userId);
  assert.equal(output.imported, 1);
  assert.equal(output.skipped, 1);
  assert.deepEqual(
    f.batches[0][0].map((r) => [r.userId, r.amount, r.isSettled, r.importBatchId]),
    [
      [userId, "-10.01", true, output.batchId],
      [userId, "-20.02", true, output.batchId],
    ],
  );
  assert.deepEqual(f.batches[0][1], [
    { userId, descriptionKey: "mercado", categoryId: f.source.categoryId },
  ]);
});

test("card import checks the selected invoice and expense limit and leaves items unsettled", async () => {
  const f = importFixture();
  const cardId = "80000000-0000-4000-8000-000000000008";
  f.input = {
    ...f.input,
    destinationType: "card",
    destinationId: cardId,
    paymentMethod: "credit_card",
    invoicePeriod: "2026-10",
  };
  Object.assign(f.dependencies, {
    findCardByIdForUser: async () => ({ id: cardId, status: "active", limit: "10.01" }),
  });
  f.dependencies.listPaidInvoicePeriodsForUser = async (id, periods, owner) => {
    assert.equal(id, cardId);
    assert.deepEqual(periods, ["2026-10"]);
    assert.equal(owner, userId);
    return [];
  };
  await f.service.importTransactions(f.input, userId);
  assert.equal(f.batches[0][0][0].accountId, null);
  assert.equal(f.batches[0][0][0].cardId, cardId);
  assert.equal(f.batches[0][0][0].isSettled, null);
  assert.equal(f.batches[0][0][0].period, "2026-10");
});

for (const [label, method, result, code] of [
  ["person", "listPeopleByIdsForUser", [], "PERSON_NOT_FOUND"],
  ["category", "listCategoriesByIdsForUser", [], "CATEGORY_NOT_FOUND"],
  ["account", "findAccountByIdForUser", { isArchived: true }, "ACCOUNT_NOT_FOUND"],
  ["card", "findCardByIdForUser", { status: "inactive" }, "CARD_NOT_FOUND"],
  ["paid invoice", "listPaidInvoicePeriodsForUser", ["2026-10"], "INVOICE_ALREADY_PAID"],
  ["credit limit", "getCardExpenseTotalForUser", 1000, "CARD_LIMIT_EXCEEDED"],
] as Array<[string, keyof TransactionsServiceDependencies, unknown, string]>) {
  test(`import rejects unavailable ${label} before creating the batch`, async () => {
    const f = importFixture();
    if (["card", "paid invoice", "credit limit"].includes(label))
      Object.assign(f.input, {
        destinationType: "card",
        destinationId: "80000000-0000-4000-8000-000000000008",
        paymentMethod: "credit_card",
        invoicePeriod: "2026-10",
      });
    Object.assign(f.dependencies, { [method]: async () => result });
    await assert.rejects(f.service.importTransactions(f.input, userId), { code });
    assert.deepEqual(f.batches, []);
  });
}

test("import undo scopes the batch and returns not found when no owned records were deleted", async () => {
  const f = importFixture();
  let deleted = [{ id: transactionId }];
  f.dependencies.deleteTransactionImportBatchForUser = async (batch, owner) => {
    assert.equal(batch, "batch");
    assert.equal(owner, userId);
    return deleted;
  };
  assert.deepEqual(await f.service.undoTransactionImport("batch", userId), {
    batchId: "batch",
    deleted: 1,
  });
  deleted = [];
  await assert.rejects(f.service.undoTransactionImport("batch", userId), {
    code: "IMPORT_BATCH_NOT_FOUND",
  });
});

async function spreadsheet(rows: ExcelJS.CellValue[][]) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Statement");
  sheet.addRows(rows);
  return Buffer.from(await workbook.xlsx.writeBuffer()).toString("base64");
}

test("spreadsheet preview decodes formulas, rich text, serial dates and category hints without importing", async () => {
  const f = importFixture();
  f.dependencies.listImportCategoryMappingsForUser = async (owner, keys) => {
    assert.equal(owner, userId);
    assert.deepEqual(keys, ["mercado", "salary", "serial"]);
    return [
      {
        descriptionKey: "mercado",
        categoryType: "expense",
        categoryId: f.source.categoryId as string,
      },
      {
        descriptionKey: "salary",
        categoryType: "expense",
        categoryId: f.source.categoryId as string,
      },
    ];
  };
  const contentBase64 = await spreadsheet([
    ["Data", "Descrição", "Valor", "Tipo", "Categoria"],
    [
      new Date("2026-09-01"),
      { richText: [{ text: "Mer" }, { text: "cado" }] },
      { formula: "-10-0.01", result: -10.01 },
      "despesa",
      "Food",
    ],
    [
      "02/09/2026",
      { text: "Salary", hyperlink: "https://example.test" },
      "2.000,35",
      "receita",
      null,
    ],
    [46266, "Serial", -1, "despesa", ""],
    ["broken", "Invalid", 10],
    ["2026-09-02", "Zero", 0],
  ]);
  const result = await f.service.previewTransactionImport(
    { fileName: "statement.xlsx", contentBase64 },
    userId,
  );
  assert.deepEqual(
    result.transactions.map((r) => [r.name, r.amount, r.type, r.suggestedCategoryId]),
    [
      ["Mercado", 10.01, "expense", f.source.categoryId],
      ["Salary", 2000.35, "income", null],
      ["Serial", 1, "expense", null],
    ],
  );
  assert.equal(result.transactions[0].purchaseDate, "2026-09-01");
  assert.match(result.transactions[2].purchaseDate, /^2026-/);
  assert.equal(result.sourceFingerprint.length, 64);
  assert.deepEqual(f.batches, []);
});

test("OFX preview identifies existing external IDs before any import write", async () => {
  const f = importFixture();
  const ofx = `<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Test Bank</ORG><FID>123</FID></FI></SONRS></SIGNONMSGSRSV1><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>123</BANKID><ACCTID>456</ACCTID></BANKACCTFROM><BANKTRANLIST><DTSTART>20260901</DTSTART><DTEND>20260930</DTEND><STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260901</DTPOSTED><TRNAMT>-10.01</TRNAMT><FITID>purchase-1</FITID><MEMO>Market</MEMO></STMTTRN><STMTTRN><TRNTYPE>CREDIT</TRNTYPE><DTPOSTED>20260902</DTPOSTED><TRNAMT>100.35</TRNAMT><FITID>income-1</FITID><MEMO>Income</MEMO></STMTTRN></BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  f.dependencies.listImportedExternalIdsForUser = async (owner, fingerprint, ids) => {
    assert.equal(owner, userId);
    assert.equal(fingerprint.length, 64);
    assert.deepEqual(ids, ["purchase-1", "income-1"]);
    return ["purchase-1"];
  };
  const result = await f.service.previewTransactionImport(
    { fileName: "statement.QFX", contentBase64: Buffer.from(ofx).toString("base64") },
    userId,
  );
  assert.deepEqual(
    result.transactions.map((row) => [row.externalId, row.type, row.amount, row.isDuplicate]),
    [
      ["purchase-1", "expense", 10.01, true],
      ["income-1", "income", 100.35, false],
    ],
  );
  assert.deepEqual(f.batches, []);
});

test("spreadsheet preview refuses more than 1000 usable rows before querying duplicates", async () => {
  const f = copyFixture();
  const rows: ExcelJS.CellValue[][] = [["Data", "Descrição", "Valor"]];
  for (let i = 0; i < 1001; i++) rows.push(["2026-09-01", `Purchase ${i}`, -1]);
  await assert.rejects(
    f.service.previewTransactionImport(
      { fileName: "statement.xlsx", contentBase64: await spreadsheet(rows) },
      userId,
    ),
    { code: "IMPORT_TOO_MANY_ROWS" },
  );
});

test("generated import template round-trips through the preview parser", async () => {
  const f = importFixture();
  const template = await f.service.generateTransactionImportTemplate();
  assert.match(template.fileName, /\.xlsx$/);
  const preview = await f.service.previewTransactionImport(template, userId);
  assert.deepEqual(
    preview.transactions.map((row) => [row.purchaseDate, row.type, row.amount]),
    [
      ["2026-07-01", "expense", 189.9],
      ["2026-07-05", "income", 5000],
    ],
  );
});

for (const [label, fileName, contentBase64, code] of [
  ["empty", "statement.ofx", "", "IMPORT_FILE_TOO_LARGE"],
  [
    "oversized",
    "statement.xlsx",
    Buffer.alloc(5 * 1024 * 1024 + 1).toString("base64"),
    "IMPORT_FILE_TOO_LARGE",
  ],
  [
    "unsupported",
    "statement.csv",
    Buffer.from("content").toString("base64"),
    "IMPORT_FORMAT_NOT_SUPPORTED",
  ],
  [
    "invalid workbook",
    "statement.xlsx",
    Buffer.from("invalid").toString("base64"),
    "IMPORT_FILE_INVALID",
  ],
] as const) {
  test(`import preview rejects ${label} input before repository access`, async () => {
    const service = createTransactionsService({} as TransactionsServiceDependencies, {
      cleanupOrphans: async () => ({ deletedCount: 0 }),
    });
    await assert.rejects(service.previewTransactionImport({ fileName, contentBase64 }, userId), {
      code,
    });
  });
}

for (const rows of [
  [],
  [["Data", "Descrição", "Valor"]],
  [
    ["Wrong", "Columns"],
    [1, 2],
  ],
  [
    ["Data", "Descrição", "Valor"],
    ["invalid", "Purchase", -10],
  ],
]) {
  test(`import preview rejects a workbook without usable rows (${JSON.stringify(rows)})`, async () => {
    const f = importFixture();
    await assert.rejects(
      f.service.previewTransactionImport(
        { fileName: "invalid.xlsx", contentBase64: await spreadsheet(rows) },
        userId,
      ),
      { code: "IMPORT_FILE_INVALID" },
    );
  });
}

for (const [now, start] of [
  ["2026-04-30T12:34:56.000Z", "2026-02-28T12:34:56.000Z"],
  ["2024-04-30T12:34:56.000Z", "2024-02-29T12:34:56.000Z"],
]) {
  test(`recent establishments clamp the two-month lookback from ${now}`, async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: new Date(now) });
    const f = copyFixture();
    f.dependencies.listRecentEstablishmentNamesForUser = async (owner, from, until, limit) => {
      assert.equal(owner, userId);
      assert.equal(from.toISOString(), start);
      assert.equal(until.toISOString(), now);
      assert.equal(limit, 100);
      return [{ name: "Market" }, { name: "Pharmacy" }];
    };
    assert.deepEqual(await f.service.listRecentEstablishments(userId), {
      items: ["Market", "Pharmacy"],
    });
  });
}

test("transaction details expose attachments and effective/planned shares without owner metadata", async () => {
  const f = copyFixture();
  f.splits.push({
    transactionId,
    personId: firstPersonId,
    personName: "Owner",
    personAvatarUrl: null,
    amount: "-54.01",
    plannedAmount: "-60.01",
  });
  f.dependencies.listTransactionIdsWithAttachmentsForUser = async (ids, owner) => {
    assert.deepEqual(ids, [transactionId]);
    assert.equal(owner, userId);
    return [{ transactionId }];
  };
  const output = await f.service.getTransactionById(transactionId, userId);
  assert.equal(output.hasAttachments, true);
  assert.equal(output.isDivided, true);
  assert.deepEqual(
    output.splitShares.map((s) => [s.amount, s.plannedAmount]),
    [[54.01, 60.01]],
  );
  assert.equal("userId" in output, false);
  assert.equal("importSourceFingerprint" in output, false);
});

test("recurring occurrence lookup restores the stored settlement state and checks its schedule", async () => {
  const f = recurringCopyFixture();
  Object.assign(f.rule, { status: "active", endDate: null, occurrenceOverrides: {} });
  Object.assign(f.dependencies, {
    listRecurringOccurrencesForUser: async () => [
      { purchaseDate: new Date("2026-10-01"), isSettled: true },
    ],
  });
  const output = await f.service.getRecurringRuleOccurrence(recurringRuleId, "2026-10-01", userId);
  assert.equal(output.isSettled, true);
  assert.equal(output.isDivided, true);
  assert.equal(output.splitShares.length, 2);
  await assert.rejects(
    f.service.getRecurringRuleOccurrence(recurringRuleId, "2026-10-02", userId),
    { code: "INVALID_RECURRING_OCCURRENCE" },
  );
});

test("a split refund conserves cents, inherits financial relations and leaves the source unchanged", async () => {
  const f = copyFixture({ refundedAmount: "10.00" });
  f.splits.push(
    ...[firstPersonId, secondPersonId].map((personId, index) => ({
      transactionId,
      personId,
      personName: "Person",
      personAvatarUrl: null,
      amount: index === 0 ? "-60.00" : "-40.00",
      plannedAmount: index === 0 ? "-60.00" : "-40.00",
    })),
  );
  const before = structuredClone(f.source);
  const drafts: Parameters<TransactionsServiceDependencies["insertTransactionRefundForUser"]>[0][] =
    [];
  f.dependencies.insertTransactionRefundForUser = async (draft) => {
    drafts.push(draft);
    return persistedTransaction({ ...f.source, id: "refund" });
  };
  const result = await f.service.createTransactionRefund(
    transactionId,
    { amount: 10.01, receivedAt: "2026-09-10", note: "  Partial refund  " },
    userId,
  );
  assert.deepEqual(result, {
    id: "refund",
    sourceTransactionId: transactionId,
    amount: 10.01,
    remainingRefundableAmount: 79.99,
  });
  assert.deepEqual(
    drafts[0].splits.map((s) => [s.personId, s.amount]),
    [
      [firstPersonId, 6],
      [secondPersonId, 4.01],
    ],
  );
  assert.equal(drafts[0].record.amount, "10.01");
  assert.equal(drafts[0].record.accountId, f.source.accountId);
  assert.equal(drafts[0].record.note, "Partial refund");
  assert.deepEqual(drafts[0].record.tagIds, f.source.tagIds);
  assert.deepEqual(f.source, before);
});

for (const scenario of [
  "income",
  "generated",
  "balance",
  "future",
  "wrong_invoice",
  "excess",
  "paid_invoice",
  "conflict",
] as const) {
  test(`refund rejects ${scenario} without partial or repeated writes`, async () => {
    const f = copyFixture();
    const input = {
      amount: 10,
      receivedAt: "2026-09-10",
      invoicePeriod: undefined as string | undefined,
    };
    let writes = 0;
    let code: string = "TRANSACTION_NOT_REFUNDABLE";
    if (scenario === "income") f.source.type = "income";
    if (scenario === "generated") f.source.origin = "refund";
    if (scenario === "balance") f.source.paymentMethod = null;
    if (scenario === "future") {
      input.receivedAt = "2999-01-01";
      code = "REFUND_DATE_FUTURE";
    }
    if (scenario === "wrong_invoice") {
      input.invoicePeriod = "2026-09";
      code = "REFUND_INVOICE_NOT_ALLOWED";
    }
    if (scenario === "excess") {
      input.amount = 100.01;
      code = "INVALID_REFUND_AMOUNT";
    }
    if (scenario === "paid_invoice") {
      f.source.cardId = "80000000-0000-4000-8000-000000000008";
      input.invoicePeriod = "2026-09";
      f.dependencies.listPaidInvoicePeriodsForUser = async () => [{ period: "2026-09" }];
      code = "INVOICE_ALREADY_PAID";
    }
    if (scenario === "conflict") code = "TRANSACTION_REFUND_CONFLICT";
    f.dependencies.insertTransactionRefundForUser = async () => {
      writes++;
      return null;
    };
    await assert.rejects(f.service.createTransactionRefund(transactionId, input, userId), { code });
    assert.equal(writes, scenario === "conflict" ? 1 : 0);
  });
}

test("card refunds require a target invoice and never settle against a financial account", async () => {
  const f = copyFixture({
    accountId: null,
    cardId: "80000000-0000-4000-8000-000000000008",
    paymentMethod: "credit_card",
  });
  const input = { amount: 10, receivedAt: "2026-09-10" };
  await assert.rejects(f.service.createTransactionRefund(transactionId, input, userId), {
    code: "REFUND_INVOICE_REQUIRED",
  });
  f.dependencies.insertTransactionRefundForUser = async (draft) => {
    assert.equal(draft.record.isSettled, null);
    assert.equal(draft.record.accountId, null);
    assert.equal(draft.record.period, "2026-10");
    assert.match(draft.record.note ?? "", /Reembolso/);
    return persistedTransaction({ ...f.source, id: "refund" });
  };
  assert.equal(
    (
      await f.service.createTransactionRefund(
        transactionId,
        { ...input, invoicePeriod: "2026-10" },
        userId,
      )
    ).amount,
    10,
  );
});

for (const scope of ["single", "future", "series", "transfer"] as const) {
  test(`deleting ${scope} targets scopes its repository operation and cleans attachments once`, async () => {
    const f = copyFixture({
      condition: scope === "future" || scope === "series" ? "installment" : "single",
      seriesId: "b0000000-0000-4000-8000-00000000000b",
      currentInstallment: 2,
      transferId: scope === "transfer" ? "transfer" : null,
    });
    const calls: unknown[][] = [];
    const remove = async (...args: unknown[]) => {
      calls.push(args);
      return [f.source];
    };
    Object.assign(f.dependencies, {
      deleteTransactionForUser: async (...args: unknown[]) => {
        calls.push(args);
        return f.source;
      },
      deleteTransactionSeriesForUser: remove,
      deleteTransactionSeriesRangeForUser: remove,
      deleteTransferPairForUser: remove,
    });
    const clean: string[] = [];
    const service = createTransactionsService(f.dependencies, {
      cleanupOrphans: async (owner) => {
        clean.push(owner);
        return { deletedCount: 1 };
      },
    });
    assert.deepEqual(
      await service.deleteTransaction(
        transactionId,
        userId,
        scope === "transfer" ? "single" : scope,
      ),
      { id: transactionId, affected: 1 },
    );
    assert.deepEqual(calls, [
      scope === "future"
        ? [f.source.seriesId, 2, userId]
        : scope === "series"
          ? [f.source.seriesId, userId]
          : scope === "transfer"
            ? ["transfer", userId]
            : [transactionId, userId],
    ]);
    assert.deepEqual(clean, [userId]);
  });
}

test("a completed deletion survives storage cleanup failure and logs it only on the server", async (t) => {
  const f = copyFixture();
  f.dependencies.deleteTransactionForUser = async () => f.source;
  const failure = new Error("Storage unavailable");
  const log = t.mock.method(console, "error", () => undefined);
  const service = createTransactionsService(f.dependencies, {
    cleanupOrphans: async () => {
      throw failure;
    },
  });
  assert.deepEqual(await service.deleteTransaction(transactionId, userId), {
    id: transactionId,
    affected: 1,
  });
  assert.equal(log.mock.callCount(), 1);
  assert.equal(log.mock.calls[0].arguments[1], failure);
});

for (const scenario of ["missing", "refunded", "concurrent_delete", "missing_transfer"] as const) {
  test(`transaction deletion rejects ${scenario} before attachment cleanup`, async () => {
    const f = copyFixture({
      ...(scenario === "refunded" ? { refundedAmount: "0.01" } : {}),
      ...(scenario === "missing_transfer" ? { transferId: "transfer" } : {}),
    });
    if (scenario === "missing")
      Object.assign(f.dependencies, { findTransactionByIdForUser: async () => undefined });
    Object.assign(f.dependencies, { deleteTransactionForUser: async () => undefined });
    f.dependencies.deleteTransferPairForUser = async () => [];
    const service = createTransactionsService(f.dependencies, {
      cleanupOrphans: async () => {
        throw new Error("Unexpected cleanup");
      },
    });
    await assert.rejects(service.deleteTransaction(transactionId, userId), {
      code:
        scenario === "refunded"
          ? "TRANSACTION_HAS_REFUNDS"
          : scenario === "missing_transfer"
            ? "TRANSFER_TRANSACTION_NOT_FOUND"
            : "TRANSACTION_NOT_FOUND",
    });
  });
}

for (const [status, action] of [
  ["active", "resume"],
  ["paused", "pause"],
  ["cancelled", "stop"],
] as const) {
  test(`legacy recurring status ${status} delegates a dated ${action} action`, async () => {
    const f = recurringCopyFixture();
    const calls: unknown[][] = [];
    f.dependencies.transitionRecurringRuleForUser = async (...args) => {
      calls.push(args);
      return true;
    };
    assert.deepEqual(
      await f.service.changeRecurringRuleStatus(recurringRuleId, userId, status, "2026-10-01"),
      { id: recurringRuleId, status },
    );
    assert.deepEqual(calls, [[recurringRuleId, userId, action, "2026-10-01"]]);
  });
}

for (const failure of [
  new RecurringTransitionError(),
  new Error("Persistence unavailable"),
  null,
]) {
  test(`recurring actions propagate ${failure?.message ?? "concurrent removal"} without retry`, async () => {
    const f = recurringCopyFixture();
    let calls = 0;
    Object.assign(f.dependencies, {
      transitionRecurringRuleForUser: async () => {
        calls++;
        if (failure) throw failure;
        return null;
      },
    });
    await assert.rejects(
      f.service.applyRecurringRuleAction(recurringRuleId, userId, {
        action: "skip",
        occurrenceDate: "2026-10-01",
      }),
      failure instanceof RecurringTransitionError
        ? { code: failure.code, status: 400 }
        : failure
          ? (error: unknown) => error === failure
          : { code: "RECURRING_RULE_NOT_FOUND" },
    );
    assert.equal(calls, 1);
  });
}

for (const [patch, update, code] of [
  [{ paymentMethod: null }, { name: "Updated" }, "BALANCE_ADJUSTMENT_IMMUTABLE"],
  [{ origin: "refund" }, { name: "Updated" }, "GENERATED_TRANSACTION_IMMUTABLE"],
  [
    { settledDate: new Date("2026-09-01"), isSettled: true },
    { amount: 50 },
    "SETTLEMENT_REQUIRES_UNDO",
  ],
  [{ isSettled: false }, { isSettled: true }, "SETTLEMENT_USE_ACTION"],
  [
    { condition: "installment", installmentCount: 3 },
    { installmentCount: 4 },
    "INSTALLMENT_COUNT_IMMUTABLE",
  ],
] as Array<
  [
    Partial<TransactionWithRelations>,
    Parameters<ReturnType<typeof createTransactionsService>["updateTransaction"]>[2],
    string,
  ]
>) {
  test(`transaction editing enforces ${code} before persistence`, async () => {
    const f = copyFixture(patch);
    await assert.rejects(f.service.updateTransaction(transactionId, userId, update), { code });
    assert.deepEqual(f.writes, []);
  });
}

test("an installment series cannot change payment structure or already-settled financial fields", async () => {
  const f = copyFixture({
    condition: "installment",
    installmentCount: 3,
    currentInstallment: 2,
    seriesId: "b0000000-0000-4000-8000-00000000000b",
  });
  await assert.rejects(
    f.service.updateTransaction(transactionId, userId, { paymentMethod: "cash" }, "future"),
    { code: "INSTALLMENT_STRUCTURE_IMMUTABLE" },
  );
  Object.assign(f.dependencies, {
    listTransactionSeriesForUser: async () => [
      persistedTransaction({ ...f.source, settledDate: new Date("2026-09-01") }),
    ],
  });
  await assert.rejects(
    f.service.updateTransaction(transactionId, userId, { amount: 50 }, "series"),
    { code: "SETTLEMENT_REQUIRES_UNDO" },
  );
});

test("future scope is invalid for a single transaction", async () => {
  const f = copyFixture();
  await assert.rejects(
    f.service.updateTransaction(transactionId, userId, { name: "Edited" }, "future"),
    { code: "INVALID_SERIES_SCOPE" },
  );
});

for (const mode of ["single", "series", "transfer"] as const) {
  test(`a concurrently removed ${mode} cannot be reported as an updated transaction`, async () => {
    const f =
      mode === "transfer"
        ? transferFixture(false)
        : copyFixture(
            mode === "series"
              ? {
                  condition: "installment",
                  installmentCount: 3,
                  currentInstallment: 2,
                  seriesId: "b0000000-0000-4000-8000-00000000000b",
                }
              : {},
          );
    Object.assign(f.dependencies, {
      listTransactionSeriesForUser: async () => [f.source],
      updateTransactionWithSplitsForUser: async () => undefined,
      updateTransactionSeriesRangeWithSplitsForUser: async () => [],
      updateTransferPairForUser: async () => undefined,
    });
    await assert.rejects(
      f.service.updateTransaction(
        transactionId,
        userId,
        { name: "Edited" },
        mode === "series" ? "future" : "single",
      ),
      { code: mode === "transfer" ? "TRANSFER_TRANSACTION_NOT_FOUND" : "TRANSACTION_NOT_FOUND" },
    );
  });
}

test("bulk settlement captures each transfer source balance once and forwards the effective date and amount", async () => {
  const f = transferFixture(false);
  const writes: unknown[][] = [];
  Object.assign(f.dependencies, {
    settleTransactionsForUser: async (...args: unknown[]) => {
      writes.push(args);
      return [{ id: transactionId }];
    },
  });
  const result = await f.service.settleTransactions(
    [transactionId, transactionId],
    userId,
    true,
    "2026-09-10",
    90.01,
  );
  assert.deepEqual(result, { ids: [transactionId], isSettled: true });
  assert.equal(f.snapshots.length, 1);
  assert.deepEqual(writes[0].slice(0, 3), [[transactionId, transactionId], userId, true]);
  assert.deepEqual(writes[0][4], {
    [f.input.sourceAccountId as string]: { displayed: 500, persisted: 450 },
  });
  assert.equal((writes[0][5] as Date).toISOString(), "2026-09-10T00:00:00.000Z");
  assert.equal(writes[0][6], 90.01);
});

test("bulk settlement rejects an incomplete owned result and undo does not query balances", async () => {
  const f = copyFixture();
  Object.assign(f.dependencies, { settleTransactionsForUser: async () => [] });
  await assert.rejects(f.service.settleTransactions([transactionId], userId, false), {
    code: "TRANSACTION_NOT_FOUND",
  });
  Object.assign(f.dependencies, { settleTransactionsForUser: async () => [{ id: transactionId }] });
  assert.deepEqual(await f.service.settleTransactions([transactionId], userId, false), {
    ids: [transactionId],
    isSettled: false,
  });
});

for (const operation of ["bulk", "recurring"] as const) {
  for (const invalid of ["account", "future_date"] as const) {
    test(`${operation} settlement rejects ${invalid} before writing`, async () => {
      const f = recurringCopyFixture();
      if (invalid === "account")
        Object.assign(f.dependencies, {
          findAccountByIdForUser: async () => ({ isArchived: true }),
        });
      const date = invalid === "future_date" ? "2999-01-01" : "2026-09-10";
      const accountId = invalid === "account" ? "90000000-0000-4000-8000-000000000009" : undefined;
      const result =
        operation === "bulk"
          ? f.service.settleTransactions([transactionId], userId, true, date, undefined, accountId)
          : f.service.settleRecurringOccurrence(
              recurringRuleId,
              "2026-10-01",
              userId,
              true,
              date,
              undefined,
              accountId,
            );
      await assert.rejects(result, {
        code: invalid === "account" ? "ACCOUNT_NOT_FOUND" : "SETTLEMENT_DATE_FUTURE",
      });
    });
  }
}

test("recurring settlement rejects off-schedule and concurrently removed occurrences", async () => {
  const f = recurringCopyFixture();
  Object.assign(f.rule, { status: "active", endDate: null });
  await assert.rejects(
    f.service.settleRecurringOccurrence(recurringRuleId, "2026-10-02", userId, true),
    { code: "INVALID_RECURRING_OCCURRENCE" },
  );
  Object.assign(f.dependencies, { settleRecurringOccurrenceForUser: async () => undefined });
  await assert.rejects(
    f.service.settleRecurringOccurrence(recurringRuleId, "2026-10-01", userId, true),
    { code: "RECURRING_RULE_NOT_FOUND" },
  );
});

for (const operation of [
  "getTransactionById",
  "getRecurringRuleOccurrence",
  "createTransactionRefund",
  "updateTransaction",
  "settleRecurringOccurrence",
  "applyRecurringRuleAction",
  "updateRecurringRule",
] as const) {
  test(`${operation} rejects a missing or unowned source`, async () => {
    const f = recurringCopyFixture();
    Object.assign(f.dependencies, {
      findTransactionByIdForUser: async () => undefined,
      findRecurringRuleByIdForUser: async () => undefined,
    });
    const result =
      operation === "getTransactionById"
        ? f.service.getTransactionById(transactionId, userId)
        : operation === "getRecurringRuleOccurrence"
          ? f.service.getRecurringRuleOccurrence(recurringRuleId, "2026-10-01", userId)
          : operation === "createTransactionRefund"
            ? f.service.createTransactionRefund(
                transactionId,
                { amount: 1, receivedAt: "2026-09-01" },
                userId,
              )
            : operation === "updateTransaction"
              ? f.service.updateTransaction(transactionId, userId, { name: "Edited" })
              : operation === "settleRecurringOccurrence"
                ? f.service.settleRecurringOccurrence(recurringRuleId, "2026-10-01", userId, true)
                : operation === "applyRecurringRuleAction"
                  ? f.service.applyRecurringRuleAction(recurringRuleId, userId, {
                      action: "pause",
                      occurrenceDate: "2026-10-01",
                    })
                  : f.service.updateRecurringRule(recurringRuleId, userId, regularInput());
    await assert.rejects(result, {
      code: ["getTransactionById", "createTransactionRefund", "updateTransaction"].includes(
        operation,
      )
        ? "TRANSACTION_NOT_FOUND"
        : "RECURRING_RULE_NOT_FOUND",
    });
  });
}

for (const operation of ["create", "import", "refund", "edit", "delete", "settle"] as const) {
  test(`transaction ${operation} preserves an unexpected persistence error and does not retry`, async () => {
    const f = importFixture();
    const failure = new Error("Persistence unavailable");
    let calls = 0;
    const fail = async () => {
      calls++;
      throw failure;
    };
    Object.assign(f.dependencies, {
      insertTransactionsWithSplits: fail,
      insertImportedTransactions: fail,
      insertTransactionRefundForUser: fail,
      updateTransactionWithSplitsForUser: fail,
      deleteTransactionForUser: fail,
      settleTransactionsForUser: fail,
    });
    const result =
      operation === "create"
        ? f.service.createTransaction({ ...regularInput(), userId })
        : operation === "import"
          ? f.service.importTransactions(f.input, userId)
          : operation === "refund"
            ? f.service.createTransactionRefund(
                transactionId,
                { amount: 1, receivedAt: "2026-09-01" },
                userId,
              )
            : operation === "edit"
              ? f.service.updateTransaction(transactionId, userId, { name: "Edited" })
              : operation === "delete"
                ? f.service.deleteTransaction(transactionId, userId)
                : f.service.settleTransactions([transactionId], userId, false);
    await assert.rejects(result, (error) => error === failure);
    assert.equal(calls, 1);
  });
}

test("installment preview HTTP contract validates amounts and returns domain options without database access", async () => {
  const service = createTransactionsService({} as TransactionsServiceDependencies, {
    cleanupOrphans: async () => ({ deletedCount: 0 }),
  });
  const route = createTransactionsRoute(service);
  for (const amount of ["", "0", "-1", "NaN", "Infinity", "0.001", "1000000000"]) {
    const response = await route.request(`/installments/preview?amount=${amount}`);
    assert.equal(response.status, 400, amount);
  }
  const response = await route.request("/installments/preview?amount=3");
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.error, null);
  const preview = InstallmentOptionsOutputSchema.parse(body.data);
  assert.deepEqual(
    preview.options.find((option) => option.count === 7),
    {
      count: 7,
      minimumAmount: 0.42,
      maximumAmount: 0.43,
    },
  );
});

test("recurrence end date HTTP contract validates counts and returns the domain end date", async () => {
  const service = createTransactionsService({} as TransactionsServiceDependencies, {
    cleanupOrphans: async () => ({ deletedCount: 0 }),
  });
  const route = createTransactionsRoute(service);
  const base = "/recurrence-end-date?startDate=2026-11-15&frequency=monthly";
  for (const query of [
    `${base}&occurrenceCount=1`,
    `${base}&occurrenceCount=361`,
    `${base}&occurrenceCount=2.5`,
    "/recurrence-end-date?startDate=2026-11-15&frequency=daily&occurrenceCount=12",
    "/recurrence-end-date?startDate=15/11/2026&frequency=monthly&occurrenceCount=12",
  ]) {
    const response = await route.request(query);
    assert.equal(response.status, 400, query);
  }

  const response = await route.request(`${base}&occurrenceCount=12`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.error, null);
  assert.deepEqual(RecurrenceEndDateOutputSchema.parse(body.data), { endDate: "2027-10-15" });

  const weeklyPayable = await route.request(
    "/recurrence-end-date?startDate=2026-11-02&dueDate=2026-11-10&frequency=weekly&occurrenceCount=2",
  );
  assert.deepEqual((await weeklyPayable.json()).data, { endDate: null });
});

test("closing-day purchases shift new singles and installments while existing and explicit periods stay fixed", async () => {
  const cardId = "80000000-0000-4000-8000-000000000008";
  let recorded = transactionFixture({
    paymentMethod: "credit_card",
    accountId: null,
    cardId,
    dueDate: null,
    purchaseDate: new Date("2026-10-05"),
    period: "2026-10",
    isSettled: null,
  });
  let installmentPeriods: string[] = [];
  const overrides = {
    listPaidInvoicePeriodsForUser: async () => [],
    getCardExpenseTotalForUser: async () => 0,
    findPersonByIdForUser: async () => ({ id: firstPersonId, name: "Pessoa", status: "active" }),
    findCategoryByIdForUser: async () => ({
      id: recorded.categoryId,
      name: "Moradia",
      type: "expense",
    }),
    findCardByIdForUser: async () => ({
      id: cardId,
      name: "Principal",
      status: "active",
      closingDay: 5,
      closingRuleType: "fixedDay",
      closingOffsetDays: null,
      closingOffsetMode: null,
      closingDayPurchasesNextInvoice: true,
      dueDay: 10,
      limit: "1000.00",
    }),
    findTransactionByIdForUser: async () => recorded,
    listTransactionSplitsForUser: async () => [],
    listTransactionIdsWithAttachmentsForUser: async () => [],
    updateTransactionWithSplitsForUser: async (
      _id: string,
      _ownerId: string,
      data: Parameters<TransactionsServiceDependencies["updateTransactionWithSplitsForUser"]>[2],
    ) => {
      recorded = { ...recorded, ...data };
      return recorded;
    },
    insertTransactionsWithSplits: async (
      records: Parameters<TransactionsServiceDependencies["insertTransactionsWithSplits"]>[0],
    ) => records.map((record) => ({ ...recorded, ...record })),
    insertInstallmentSeriesWithTransactions: async (
      _series: Parameters<
        TransactionsServiceDependencies["insertInstallmentSeriesWithTransactions"]
      >[0],
      records: Parameters<
        TransactionsServiceDependencies["insertInstallmentSeriesWithTransactions"]
      >[1],
    ) => {
      installmentPeriods = records.map((record) => record.period);
      return records.map((record) => ({ ...recorded, ...record }));
    },
  };
  const dependencies = new Proxy(overrides, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return async () => {
        throw new Error(`Unexpected dependency call: ${String(property)}`);
      };
    },
  }) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  const edited = await service.updateTransaction(transactionId, userId, {
    name: "Compra renomeada",
  });
  assert.equal(edited.period, "2026-10");
  const input = TransactionInputSchema.parse({
    type: "expense",
    paymentMethod: "credit_card",
    name: "Compra nova",
    amount: 300,
    purchaseDate: "2026-10-05",
    personId: firstPersonId,
    cardId,
    categoryId: recorded.categoryId,
  });
  assert.equal((await service.createTransaction({ ...input, userId })).period, "2026-11");
  assert.equal(
    (await service.createTransaction({ ...input, userId, invoicePeriod: "2026-10" })).period,
    "2026-10",
  );
  await service.createTransaction({
    ...input,
    userId,
    condition: "installment",
    installmentCount: 3,
  });
  assert.deepEqual(installmentPeriods, ["2026-11", "2026-12", "2027-01"]);
});

test("recurring edit query keeps legacy whole-series updates and requires a scoped date", () => {
  assert.deepEqual(UpdateRecurringRuleQuerySchema.parse({}), { scope: "series" });
  assert.equal(UpdateRecurringRuleQuerySchema.safeParse({ scope: "single" }).success, false);
  assert.equal(
    UpdateRecurringRuleQuerySchema.safeParse({
      scope: "future",
      occurrenceDate: "2026-10-01",
    }).success,
    true,
  );
});

function transactionFixture(
  overrides: Partial<TransactionWithRelations> = {},
): TransactionWithRelations {
  return {
    id: transactionId,
    userId,
    personId: firstPersonId,
    type: "expense",
    origin: "regular",
    condition: "single",
    paymentMethod: "boleto",
    name: "Conta de energia",
    amount: "-100.00",
    purchaseDate: new Date("2026-08-23T00:00:00.000Z"),
    period: "2026-09",
    accountId: "50000000-0000-4000-8000-000000000005",
    cardId: null,
    categoryId: "60000000-0000-4000-8000-000000000006",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-09-04T00:00:00.000Z"),
    boletoPaymentDate: null,
    installmentCount: null,
    currentInstallment: null,
    seriesId: null,
    transferId: null,
    recurringRuleId: null,
    isSettled: false,
    note: null,
    importSourceFingerprint: null,
    importExternalId: null,
    importBatchId: null,
    createdAt: new Date("2026-08-23T12:00:00.000Z"),
    updatedAt: new Date("2026-08-23T12:00:00.000Z"),
    personName: "Pessoa 1",
    personAvatarUrl: null,
    accountName: "Conta principal",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    invoicePaymentCardName: null,
    invoicePaymentCardLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    refundSourceId: null,
    refundedAmount: "0",
    anticipationId: null,
    installmentOriginalPeriod: null,
    ...overrides,
  };
}

test("editing a transfer preserves the pair identity in both persistence payloads", async () => {
  const sourceAccountId = "50000000-0000-4000-8000-000000000005";
  const destinationAccountId = "90000000-0000-4000-8000-000000000009";
  const transferId = "a0000000-0000-4000-8000-00000000000a";
  let stored = transactionFixture({
    type: "transfer",
    paymentMethod: "bank_transfer",
    sourceAccountId,
    destinationAccountId,
    transferId,
    accountId: sourceAccountId,
    dueDate: null,
    amount: "-30.01",
    isSettled: true,
  });
  let writes = 0;
  const overrides = {
    findTransactionByIdForUser: async () => stored,
    findAdminPersonByUserId: async () => ({ id: firstPersonId, status: "active" }),
    findSystemCategoryByNameForUser: async () => ({ id: stored.categoryId }),
    findAccountByIdForUser: async () => ({ isArchived: false }),
    listTransactionSplitsForUser: async () => [],
    listTransactionIdsWithAttachmentsForUser: async () => [],
    getAccountBalanceSnapshotForUser: async () => ({ displayed: 69.99, persisted: 69.99 }),
    updateTransferPairForUser: async (
      id: string,
      ownerId: string,
      outgoing: Parameters<TransactionsServiceDependencies["updateTransferPairForUser"]>[2],
      incoming: Parameters<TransactionsServiceDependencies["updateTransferPairForUser"]>[3],
    ) => {
      writes += 1;
      assert.equal(id, transferId);
      assert.equal(ownerId, userId);
      assert.equal("transferId" in outgoing, false);
      assert.equal("transferId" in incoming, false);
      assert.equal(outgoing.amount, "-40.01");
      assert.equal(incoming.amount, "40.01");
      assert.equal(outgoing.accountId, sourceAccountId);
      assert.equal(incoming.accountId, destinationAccountId);
      stored = { ...stored, ...outgoing };
      return stored;
    },
  };
  const dependencies = new Proxy(overrides, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return async () => {
        throw new Error(`Unexpected dependency call: ${String(property)}`);
      };
    },
  }) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    cleanupOrphans: async () => ({ deletedCount: 0 }),
  });
  const updated = await service.updateTransaction(transactionId, userId, { amount: 40.01 });
  assert.equal(writes, 1);
  assert.equal(updated.recordId, transactionId);
  assert.equal(stored.transferId, transferId);
});

test("account statement lists a paid boleto in its payment month while transactions keep the due month", async () => {
  const accountId = "50000000-0000-4000-8000-000000000005";
  const paidBoleto = transactionFixture({
    purchaseDate: new Date("2026-07-20T00:00:00.000Z"),
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    boletoPaymentDate: new Date("2026-08-28T00:00:00.000Z"),
    isSettled: true,
  });
  const dependencies = new Proxy(
    {
      listAccountStatementTransactionsForUser: async (_userId: string, period: string) =>
        period === "2026-08" ? [paidBoleto] : [],
      listTransactionsByPeriod: async (_userId: string, period: string) =>
        period === "2026-09" ? [paidBoleto] : [],
      listRecurringRulesForPeriod: async () => [],
      listSettledRecurringBoletoOccurrencesByPaymentDateForUser: async () => [],
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [],
      listTransactionSplitsForUser: async () => [],
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  const statementQuery = (period: string) =>
    ListTransactionsQuerySchema.parse({ view: "accountStatement", period, accountIds: accountId });

  const augustStatement = await service.listTransactions(userId, statementQuery("2026-08"));
  const septemberStatement = await service.listTransactions(userId, statementQuery("2026-09"));
  const augustTransactions = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-08" }),
  );
  const septemberTransactions = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09" }),
  );

  assert.equal(augustStatement.total, 1);
  assert.equal(augustStatement.items[0]?.postingDate, "2026-08-28");
  assert.equal(augustStatement.items[0]?.period, "2026-09");
  assert.equal(septemberStatement.total, 0);
  assert.equal(augustTransactions.total, 0);
  assert.equal(septemberTransactions.total, 1);
  assert.equal(
    ListTransactionsQuerySchema.safeParse({ view: "accountStatement", period: "2026-08" }).success,
    false,
  );
});

test("account statement includes an early recurring boleto payment before the rule starts", async () => {
  const rule: RecurringRuleWithRelations = {
    id: recurringRuleId,
    userId,
    seriesId: "80000000-0000-4000-8000-000000000008",
    personId: firstPersonId,
    type: "expense",
    paymentMethod: "boleto",
    name: "Conta de energia",
    amount: "-100.00",
    anchorDate: new Date("2026-09-01T00:00:00.000Z"),
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    frequency: "monthly",
    accountId: "50000000-0000-4000-8000-000000000005",
    cardId: null,
    categoryId: "60000000-0000-4000-8000-000000000006",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    isSettled: false,
    note: null,
    status: "active",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    personName: "Pessoa 1",
    personAvatarUrl: null,
    accountName: "Conta principal",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardClosingDayPurchasesNextInvoice: null,
    cardDueDay: null,
  };
  const occurrence = {
    recurringRuleId,
    recurringSeriesId: rule.seriesId,
    purchaseDate: new Date("2026-09-01T00:00:00.000Z"),
    isSettled: true,
    accountId: null,
    boletoPaymentDate: new Date("2026-08-28T00:00:00.000Z"),
  };
  const dependencies = new Proxy(
    {
      listAccountStatementTransactionsForUser: async () => [],
      listTransactionsByPeriod: async () => [],
      listRecurringRulesForPeriod: async (_userId: string, end: Date) =>
        end.toISOString().startsWith("2026-09") ? [rule] : [],
      listRecurringRulesByIdsForUser: async () => [rule],
      listSettledRecurringBoletoOccurrencesByPaymentDateForUser: async (
        _userId: string,
        _accountId: string,
        start: Date,
      ) => (start.toISOString().startsWith("2026-08") ? [occurrence] : []),
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [occurrence],
      listTransactionSplitsForUser: async () => [],
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  const statementQuery = (period: string) =>
    ListTransactionsQuerySchema.parse({
      view: "accountStatement",
      period,
      accountIds: rule.accountId,
    });

  const augustStatement = await service.listTransactions(userId, statementQuery("2026-08"));
  const septemberStatement = await service.listTransactions(userId, statementQuery("2026-09"));
  const septemberTransactions = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09" }),
  );

  assert.equal(augustStatement.total, 1);
  assert.equal(augustStatement.items[0]?.postingDate, "2026-08-28");
  assert.equal(augustStatement.items[0]?.period, "2026-09");
  assert.equal(septemberStatement.total, 0);
  assert.equal(septemberTransactions.total, 1);
  assert.equal(septemberTransactions.items[0]?.isSettled, true);
  assert.equal(septemberTransactions.items[0]?.boletoPaymentDate, "2026-08-28");
});

test("editing a recurring boleto preserves the rule settlement state", async () => {
  const rule: RecurringRuleWithRelations = {
    id: recurringRuleId,
    userId,
    seriesId: "80000000-0000-4000-8000-000000000008",
    personId: firstPersonId,
    type: "expense",
    paymentMethod: "boleto",
    name: "Conta de energia",
    amount: "-100.00",
    anchorDate: new Date("2026-09-01T00:00:00.000Z"),
    startDate: new Date("2026-09-01T00:00:00.000Z"),
    endDate: null,
    frequency: "monthly",
    accountId: "50000000-0000-4000-8000-000000000005",
    cardId: null,
    categoryId: "60000000-0000-4000-8000-000000000006",
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-09-10T00:00:00.000Z"),
    isSettled: false,
    note: null,
    status: "active",
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    personName: "Pessoa 1",
    personAvatarUrl: null,
    accountName: "Conta principal",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    categoryName: "Moradia",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardClosingDayPurchasesNextInvoice: null,
    cardDueDay: null,
  };
  let savedSettlement: boolean | null | undefined;
  const versions = [{ id: rule.id, startDate: rule.startDate, updatedAt: rule.updatedAt }];
  const writes: Array<{
    values: { isSettled?: boolean | null; anchorDate?: Date; startDate?: Date; frequency?: string };
    splits: Array<{ personId: string; amount: string }>;
  }> = [];
  const scopes: Array<{
    scope: "single" | "future" | "series";
    hasPrevious: boolean;
    previousDate: Date;
    nextDate: Date | null;
  }> = [];
  const dependencies = new Proxy(
    {
      findRecurringRuleByIdForUser: async () => rule,
      listRecurringRulesBySeriesForUser: async () => versions,
      findPersonByIdForUser: async () => ({ id: firstPersonId, status: "active" }),
      findCategoryByIdForUser: async () => ({
        id: rule.categoryId,
        type: "expense",
        name: "Moradia",
      }),
      findAccountByIdForUser: async () => ({ id: rule.accountId, isArchived: false }),
      updateRecurringRuleWithSplitsForUser: async (
        _id: string,
        _userId: string,
        values: (typeof writes)[number]["values"],
        splits: (typeof writes)[number]["splits"],
        options: (typeof scopes)[number],
      ) => {
        savedSettlement = values.isSettled;
        writes.push({ values, splits });
        scopes.push(options);
        return { ...rule, ...values };
      },
      listRecurringOccurrencesForUser: async (_seriesIds: string[], startDate: Date) =>
        startDate.toISOString().startsWith("2026-10")
          ? [
              {
                recurringSeriesId: rule.seriesId,
                purchaseDate: new Date("2026-10-01T00:00:00.000Z"),
                isSettled: true,
              },
            ]
          : [],
      listRecurringSplitsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  const input: TransactionInput = {
    type: "expense",
    condition: "recurring",
    paymentMethod: "boleto",
    name: "Conta de energia atualizada",
    amount: 100,
    purchaseDate: "2026-09-01",
    personId: firstPersonId,
    accountId: rule.accountId,
    cardId: null,
    categoryId: rule.categoryId,
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: "2026-09-10",
    boletoPaymentDate: null,
    recurrenceFrequency: "monthly",
    isSettled: true,
  };

  const result = await service.updateRecurringRule(recurringRuleId, userId, input);

  assert.equal(savedSettlement, false);
  assert.equal(result.isSettled, false);
  assert.equal(result.name, "Conta de energia atualizada");

  const laterInput = {
    ...input,
    purchaseDate: "2026-10-01",
    dueDate: "2026-10-10",
    splitShares: [
      { personId: firstPersonId, amount: 60 },
      { personId: secondPersonId, amount: 40 },
    ],
  };
  const singleResult = await service.updateRecurringRule(recurringRuleId, userId, laterInput, {
    scope: "single",
    occurrenceDate: "2026-10-01",
  });
  assert.equal(singleResult.isSettled, true);
  assert.equal(singleResult.dueDate, "2026-10-10");
  await service.updateRecurringRule(recurringRuleId, userId, laterInput, {
    scope: "future",
    occurrenceDate: "2026-10-01",
  });
  assert.deepEqual(writes[1]?.splits, [
    { personId: firstPersonId, amount: "-60.00" },
    { personId: secondPersonId, amount: "-40.00" },
  ]);
  assert.equal(writes[1]?.values.isSettled, false);

  assert.deepEqual(
    scopes.map(({ scope, hasPrevious, previousDate, nextDate }) => ({
      scope,
      hasPrevious,
      previousDate: previousDate.toISOString().slice(0, 10),
      nextDate: nextDate?.toISOString().slice(0, 10) ?? null,
    })),
    [
      { scope: "series", hasPrevious: false, previousDate: "2026-08-31", nextDate: "2026-10-01" },
      { scope: "single", hasPrevious: true, previousDate: "2026-09-30", nextDate: "2026-11-01" },
      { scope: "future", hasPrevious: true, previousDate: "2026-09-30", nextDate: "2026-11-01" },
    ],
  );
  await assert.rejects(() =>
    service.updateRecurringRule(
      recurringRuleId,
      userId,
      { ...laterInput, purchaseDate: "2026-10-02" },
      { scope: "single", occurrenceDate: "2026-10-01" },
    ),
  );
  assert.equal(scopes.length, 3);

  versions.push({
    id: "90000000-0000-4000-8000-000000000009",
    startDate: new Date("2026-11-01T00:00:00.000Z"),
    updatedAt: new Date("2026-11-01T00:00:00.000Z"),
  });
  await service.updateRecurringRule(recurringRuleId, userId, laterInput, {
    scope: "series",
    occurrenceDate: "2026-10-01",
  });
  assert.equal(writes[3]?.values.anchorDate, undefined);
  assert.equal(writes[3]?.values.startDate, undefined);
  assert.equal(writes[3]?.values.frequency, undefined);
  assert.equal(writes[3]?.values.isSettled, undefined);
  await assert.rejects(() =>
    service.updateRecurringRule(
      recurringRuleId,
      userId,
      { ...laterInput, recurrenceFrequency: "weekly" },
      { scope: "series", occurrenceDate: "2026-10-01" },
    ),
  );
  assert.equal(writes.length, 4);
  await service.updateRecurringRule(
    recurringRuleId,
    userId,
    { ...laterInput, purchaseDate: "2026-10-02", recurrenceFrequency: "weekly" },
    { scope: "future", occurrenceDate: "2026-10-01" },
  );
  assert.equal(writes[4]?.values.anchorDate?.toISOString().slice(0, 10), "2026-10-02");
  assert.equal(writes[4]?.values.frequency, "weekly");
  await service.updateRecurringRule(
    recurringRuleId,
    userId,
    {
      ...laterInput,
      purchaseDate: "2026-10-02",
    },
    { scope: "future", occurrenceDate: "2026-10-01" },
  );
  assert.equal(writes[5]?.values.anchorDate?.toISOString().slice(0, 10), "2026-10-02");
});

test("divided transactions become allocation rows linked to the same editable record", async () => {
  const transaction = transactionFixture();
  let listedTransactions = [transaction];
  const dependencies = new Proxy(
    {
      listTransactionsByPeriod: async () => listedTransactions,
      listRecurringRulesForPeriod: async () => [],
      listTransactionSplitsForUser: async () => [
        {
          transactionId,
          personId: firstPersonId,
          personName: "Pessoa 1",
          personAvatarUrl: null,
          amount: "-50.00",
        },
        {
          transactionId,
          personId: secondPersonId,
          personName: "Pessoa 2",
          personAvatarUrl: null,
          amount: "-50.00",
        },
      ],
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [],
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });

  const result = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09" }),
  );

  assert.equal(result.total, 1);
  assert.deepEqual(
    result.items.map((item) => [
      item.id,
      item.recordId,
      item.allocation?.personId,
      item.allocation?.amount,
      item.displayAmount,
    ]),
    [
      [`${transactionId}:${firstPersonId}`, transactionId, firstPersonId, -50, 100],
      [`${transactionId}:${secondPersonId}`, transactionId, secondPersonId, -50, 100],
    ],
  );
  assert.deepEqual(
    result.items[0]?.splitShares.map((share) => [share.personId, share.amount]),
    [
      [firstPersonId, 50],
      [secondPersonId, 50],
    ],
  );

  const filtered = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({
      period: "2026-09",
      personIds: secondPersonId,
      minAmount: 40,
      maxAmount: 60,
    }),
  );

  assert.equal(filtered.total, 1);
  assert.equal(filtered.items[0]?.allocation?.personId, secondPersonId);
  assert.equal(filtered.items[0]?.allocation?.amount, -50);

  // Five purchases fit on a page, even when one has two allocation rows.
  listedTransactions = [
    transaction,
    ...Array.from({ length: 5 }, (_, index) =>
      transactionFixture({
        id: `${index + 7}0000000-0000-4000-8000-000000000001`,
        purchaseDate: new Date("2026-08-22T00:00:00.000Z"),
        name: `Compra ${index}`,
        amount: `-${(index + 2) * 100}.00`,
      }),
    ),
  ];
  const paged = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", pageSize: 5 }),
  );
  assert.equal(paged.total, 6);
  assert.equal(paged.items.length, 6);
  assert.equal(paged.items.filter((item) => item.recordId === transactionId).length, 2);
  const nextPage = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", pageSize: 5, page: 2 }),
  );
  assert.equal(nextPage.items.length, 1);
  assert.equal(
    nextPage.items.some((item) => item.recordId === transactionId),
    false,
  );
  const byAmount = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", sort: "amount" }),
  );
  assert.equal(byAmount.items[0]?.amount, -600);
  const searched = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", q: "única" }),
  );
  assert.equal(searched.total, 6);
  listedTransactions = [
    transactionFixture({
      paymentMethod: "credit_card",
      isSettled: null,
      cardId: "70000000-0000-4000-8000-000000000007",
    }),
    transactionFixture({ id: "80000000-0000-4000-8000-000000000008", isSettled: true }),
  ];
  const invoiceOnly = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", settlement: "invoice" }),
  );
  assert.equal(invoiceOnly.total, 1);
  assert.ok(invoiceOnly.items.every((item) => item.isSettled === null));
});

test("installment series reallocates divided shares proportionally for each target amount", async () => {
  const seriesId = "70000000-0000-4000-8000-000000000007";
  const secondTransactionId = "80000000-0000-4000-8000-000000000008";
  const thirdTransactionId = "90000000-0000-4000-8000-000000000009";
  const anchor = transactionFixture({
    amount: "-10.01",
    condition: "installment",
    installmentCount: 3,
    currentInstallment: 1,
    seriesId,
  });
  let receivedUpdates: Parameters<
    TransactionsServiceDependencies["updateTransactionSeriesRangeWithSplitsForUser"]
  >[1] = [];
  const dependencies = new Proxy(
    {
      findTransactionByIdForUser: async () => anchor,
      listTransactionSplitsForUser: async () => [
        {
          transactionId,
          personId: firstPersonId,
          personName: "Pessoa 1",
          personAvatarUrl: null,
          amount: "-5.01",
        },
        {
          transactionId,
          personId: secondPersonId,
          personName: "Pessoa 2",
          personAvatarUrl: null,
          amount: "-5.00",
        },
      ],
      findPersonByIdForUser: async (id: string) => ({ id, name: "Pessoa", status: "active" }),
      findCategoryByIdForUser: async () => ({
        id: anchor.categoryId,
        name: "Moradia",
        type: "expense",
      }),
      findAccountByIdForUser: async () => ({ id: anchor.accountId, isArchived: false }),
      listTransactionSeriesForUser: async () => [
        {
          id: transactionId,
          amount: "-10.01",
          purchaseDate: anchor.purchaseDate,
          period: "2026-09",
          dueDate: anchor.dueDate,
          boletoPaymentDate: null,
          currentInstallment: 1,
          isSettled: false,
        },
        {
          id: secondTransactionId,
          amount: "-10.00",
          purchaseDate: anchor.purchaseDate,
          period: "2026-10",
          dueDate: new Date("2026-10-04T00:00:00.000Z"),
          boletoPaymentDate: null,
          currentInstallment: 2,
          isSettled: false,
        },
        {
          id: thirdTransactionId,
          amount: "-10.00",
          purchaseDate: anchor.purchaseDate,
          period: "2026-11",
          dueDate: new Date("2026-11-04T00:00:00.000Z"),
          boletoPaymentDate: null,
          currentInstallment: 3,
          isSettled: false,
        },
      ],
      updateTransactionSeriesRangeWithSplitsForUser: async (
        _userId: string,
        updates: typeof receivedUpdates,
      ) => {
        receivedUpdates = updates;
        return updates.map((update) => update.id);
      },
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });

  await service.updateTransaction(
    transactionId,
    userId,
    {
      splitShares: [
        { personId: firstPersonId, amount: 6.68 },
        { personId: secondPersonId, amount: 3.33 },
      ],
    },
    "series",
  );

  assert.deepEqual(
    receivedUpdates.map((update) => update.splits),
    [
      [
        { personId: firstPersonId, amount: "-6.68" },
        { personId: secondPersonId, amount: "-3.33" },
      ],
      [
        { personId: firstPersonId, amount: "-6.67" },
        { personId: secondPersonId, amount: "-3.33" },
      ],
      [
        { personId: firstPersonId, amount: "-6.67" },
        { personId: secondPersonId, amount: "-3.33" },
      ],
    ],
  );
});

test("invoice adjustments can only be removed through the invoice workflow", async () => {
  const dependencies = new Proxy(
    {
      findTransactionByIdForUser: async () =>
        transactionFixture({
          origin: "invoiceAdjustment",
          paymentMethod: "credit_card",
          cardId: "70000000-0000-4000-8000-000000000007",
        }),
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });

  await assert.rejects(
    service.deleteTransaction(transactionId, userId),
    (error: { code?: string }) => error.code === "GENERATED_TRANSACTION_IMMUTABLE",
  );
});

test("settlement preserves the chosen boleto payment date and rejects future dates without writes", async () => {
  const paymentDates: Date[] = [];
  const fixture = transactionFixture();
  const dependencies = new Proxy(
    {
      findTransactionByIdForUser: async () => fixture,
      settleTransactionsForUser: async (
        _ids: string[],
        _userId: string,
        _settled: boolean,
        _period: string,
        _snapshots: unknown,
        date: Date,
      ) => {
        paymentDates.push(date);
        return [fixture];
      },
      findRecurringRuleByIdForUser: async () => ({
        id: recurringRuleId,
        status: "active",
        anchorDate: new Date("2020-01-04T00:00:00.000Z"),
        startDate: new Date("2020-01-04T00:00:00.000Z"),
        endDate: null,
        frequency: "monthly",
        paymentMethod: "boleto",
      }),
      settleRecurringOccurrenceForUser: async (
        _id: string,
        _purchaseDate: Date,
        _userId: string,
        _settled: boolean,
        date: Date,
      ) => {
        paymentDates.push(date);
        return fixture;
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans() {
      return { deletedCount: 0 };
    },
  });
  await service.settleTransactions([transactionId], userId, true, "2020-02-01");
  await service.settleRecurringOccurrence(transactionId, "2020-01-04", userId, true, "2020-02-02");
  assert.deepEqual(
    paymentDates.map((date) => date.toISOString()),
    ["2020-02-01T00:00:00.000Z", "2020-02-02T00:00:00.000Z"],
  );
  await assert.rejects(service.settleTransactions([transactionId], userId, true, "9999-01-01"), {
    code: "SETTLEMENT_DATE_FUTURE",
  });
  await assert.rejects(
    service.settleRecurringOccurrence(transactionId, "2020-01-04", userId, true, "9999-01-01"),
    { code: "SETTLEMENT_DATE_FUTURE" },
  );
  assert.equal(paymentDates.length, 2);
});

test("transaction tag filtering uses union semantics before pagination", async () => {
  const firstTag = "a0000000-0000-4000-8000-000000000001";
  const secondTag = "b0000000-0000-4000-8000-000000000002";
  const dependencies = new Proxy(
    {
      listTransactionsByPeriod: async () => [
        transactionFixture({ tagIds: [firstTag, secondTag] }),
        transactionFixture({ id: "c0000000-0000-4000-8000-000000000003", tagIds: [] }),
      ],
      listRecurringRulesForPeriod: async () => [],
      listTransactionSplitsForUser: async () => [],
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [],
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, key) {
        if (key in target) return target[key as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency: ${String(key)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    cleanupOrphans: async () => ({ deletedCount: 0 }),
  });
  const result = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", tagIds: `${firstTag},${secondTag}` }),
  );
  assert.equal(result.total, 1);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0].tagIds, [firstTag, secondTag]);
  const untagged = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", withoutTags: "true" }),
  );
  assert.equal(untagged.total, 1);
  assert.equal(untagged.items.length, 1);
  assert.deepEqual(untagged.items[0].tagIds, []);
});

test("untagged filters reject conflicting tag selections and malformed switches", () => {
  assert.equal(
    ListTransactionsQuerySchema.safeParse({
      withoutTags: "true",
      tagIds: "a0000000-0000-4000-8000-000000000001",
    }).success,
    false,
  );
  assert.equal(ListTransactionsQuerySchema.safeParse({ withoutTags: "false" }).success, false);
  assert.equal(ListTransactionsQuerySchema.parse({ withoutTags: "true" }).withoutTags, true);
});

test("transaction exports preserve filters and ordering across all pages for the authenticated owner", async () => {
  const dependencies = new Proxy(
    {
      listTransactionsByPeriod: async (ownerId: string, period: string) => {
        assert.equal(ownerId, userId);
        assert.equal(period, "2026-09");
        return Array.from({ length: 8 }, (_, index) =>
          transactionFixture({
            id: `20000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
            name: index === 7 ? "Outro lançamento" : `Energia ${index}`,
          }),
        );
      },
      listRecurringRulesForPeriod: async () => [],
      listTransactionSplitsForUser: async () => [],
      listRecurringSplitsForUser: async () => [],
      listRecurringOccurrencesForUser: async () => [],
      listTransactionIdsWithAttachmentsForUser: async () => [],
    },
    {
      get(target, key) {
        if (key in target) return target[key as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected export dependency: ${String(key)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    cleanupOrphans: async () => ({ deletedCount: 0 }),
  });
  const app = new Hono<{ Variables: ApiVariables }>();
  app.use("*", async (context, next) => {
    context.set("userId", userId);
    await next();
  });
  app.route("/", createTransactionsRoute(service));

  const page = await service.listTransactions(
    userId,
    ListTransactionsQuerySchema.parse({ period: "2026-09", q: "Energia", page: 2, pageSize: 5 }),
  );
  assert.equal(page.items.length, 2);
  const response = await app.request(
    "/export?period=2026-09&q=Energia&sort=oldest&page=2&pageSize=5&format=csv",
  );
  assert.equal(response.status, 200);
  const { data } = await response.json();
  assert.equal(data.rowCount, 7);
  assert.equal(data.fileName, "lancamentos-2026-09.csv");
  const csv = Buffer.from(data.contentBase64, "base64").toString("utf8");
  assert.equal(csv.startsWith("\uFEFF"), true);
  assert.equal(csv.includes("Outro lançamento"), false);
  assert.ok(csv.indexOf('"Energia 0"') < csv.indexOf('"Energia 6"'));
  assert.equal(csv.includes(userId), false);

  for (const suffix of [
    "format=pdf",
    "format=xlsx&dateStart=2026-09-30&dateEnd=2026-09-01",
    "format=csv&withoutTags=true&tagIds=a0000000-0000-4000-8000-000000000001",
  ]) {
    assert.equal((await app.request(`/export?${suffix}`)).status, 400);
  }

  const item = {
    ...page.items[0],
    name: '=HYPERLINK("https://example.com")',
    note: 'linha 1; "aspas"\nlinha 2',
    allocation: {
      personId: secondPersonId,
      personName: "Pessoa 2",
      personAvatarUrl: null,
      amount: -34.5,
    },
  };
  const safeCsv = await createTransactionsExport(
    [item],
    ExportTransactionsQuerySchema.parse({ format: "csv", period: "2026-09" }),
  );
  const safeText = Buffer.from(safeCsv.contentBase64, "base64").toString("utf8");
  assert.ok(safeText.includes('"\'=HYPERLINK(""https://example.com"")"'));
  assert.ok(safeText.includes('"linha 1; ""aspas""\nlinha 2"'));
  assert.ok(safeText.includes(";-34,50;"));
  assert.ok(safeText.includes('"Pessoa 2"'));

  const xlsx = await createTransactionsExport(
    [item],
    ExportTransactionsQuerySchema.parse({
      format: "xlsx",
      dateStart: "2026-09-01",
      dateEnd: "2026-09-30",
    }),
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Uint8Array.from(Buffer.from(xlsx.contentBase64, "base64")).buffer);
  const sheet = workbook.getWorksheet("Lançamentos");
  assert.ok(sheet);
  assert.equal(sheet.getCell("C2").value, item.name);
  assert.equal(sheet.getCell("C2").type, ExcelJS.ValueType.String);
  assert.equal(sheet.getCell("F2").value, "Pessoa 2");
  assert.equal(sheet.getCell("P2").value, -34.5);
  assert.ok(sheet.getCell("A2").value instanceof Date);
  assert.equal(sheet.getCell("A2").numFmt, "dd/mm/yyyy");
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(xlsx.fileName, "lancamentos-2026-09-01_2026-09-30.xlsx");
});

test("transactions reject tags belonging to another user before writing", async () => {
  let wrote = false;
  const service = createTransactionsService(
    new Proxy(
      {
        listTagsByIdsForUser: async () => [],
        insertTransactionsWithSplits: async () => {
          wrote = true;
          return [];
        },
      },
      {
        get(target, key) {
          if (key in target) return target[key as keyof typeof target];
          return async () => {
            throw new Error(`Unexpected dependency: ${String(key)}`);
          };
        },
      },
    ) as unknown as TransactionsServiceDependencies,
    { cleanupOrphans: async () => ({ deletedCount: 0 }) },
  );
  const input = TransactionInputSchema.parse({
    type: "expense",
    paymentMethod: "pix",
    name: "Teste",
    amount: 10,
    purchaseDate: "2026-09-01",
    personId: firstPersonId,
    accountId: "50000000-0000-4000-8000-000000000005",
    categoryId: "60000000-0000-4000-8000-000000000006",
    tagIds: ["a0000000-0000-4000-8000-000000000001"],
  });
  await assert.rejects(() => service.createTransaction({ ...input, userId }), {
    code: "tag_not_found",
  });
  assert.equal(wrote, false);
});

function copyFixture(overrides: Partial<TransactionWithRelations> = {}) {
  const source = transactionFixture({
    paymentMethod: "pix",
    dueDate: null,
    note: "Original note",
    purchaseDate: new Date("2026-10-01"),
    tagIds: ["90000000-0000-4000-8000-000000000009"],
    ...overrides,
  });
  const writes: Array<Parameters<TransactionsServiceDependencies["insertTransactionsWithSplits"]>> =
    [];
  const links: unknown[][] = [];
  const splits: Awaited<
    ReturnType<TransactionsServiceDependencies["listTransactionSplitsForUser"]>
  > = [];
  const dependencies = new Proxy(
    {
      findInstallmentSeriesByIdForUser: async () => ({ originalAmount: "150.00" }),
      findTransactionByIdForUser: async (id: string, owner: string) => {
        assert.equal(id, transactionId);
        assert.equal(owner, userId);
        return source;
      },
      findPersonByIdForUser: async (_id: string, owner: string) => {
        assert.equal(owner, userId);
        return { id: _id, name: "Person", status: "active" };
      },
      findCategoryByIdForUser: async (_id: string, owner: string) => {
        assert.equal(owner, userId);
        return { id: _id, name: "Category", type: source.type };
      },
      findAccountByIdForUser: async (_id: string, owner: string) => {
        assert.equal(owner, userId);
        return { id: _id, isArchived: false };
      },
      findCardByIdForUser: async () => ({
        id: source.cardId,
        name: "Card",
        status: "active",
        closingDay: 20,
        closingRuleType: "fixedDay",
        closingOffsetDays: null,
        closingOffsetMode: null,
        closingDayPurchasesNextInvoice: false,
        dueDay: 25,
        limit: "1000",
      }),
      listTagsByIdsForUser: async (ids: string[], owner: string) => {
        assert.equal(owner, userId);
        return ids.map((id) => ({ id }));
      },
      listPaidInvoicePeriodsForUser: async () => [],
      getCardExpenseTotalForUser: async () => 0,
      listTransactionSplitsForUser: async (ids: string[], owner: string) => {
        assert.deepEqual(ids, [transactionId]);
        assert.equal(owner, userId);
        return splits;
      },
      insertTransactionsWithSplits: async (
        ...args: Parameters<TransactionsServiceDependencies["insertTransactionsWithSplits"]>
      ) => {
        writes.push(args);
        return args[0].map((record) => ({
          ...source,
          ...record,
          id: "a0000000-0000-4000-8000-00000000000a",
        }));
      },
      copyTransactionAttachmentLinksForUser: async (...args: unknown[]) => {
        links.push(args);
      },
    },
    {
      get(target, property) {
        if (property in target) return target[property as keyof typeof target];
        return async () => {
          throw new Error(`Unexpected dependency call: ${String(property)}`);
        };
      },
    },
  ) as unknown as TransactionsServiceDependencies;
  return {
    source,
    writes,
    links,
    splits,
    dependencies,
    get service() {
      return createTransactionsService(dependencies, {
        cleanupOrphans: async () => ({ deletedCount: 0 }),
      });
    },
  };
}

for (const type of ["income", "expense"] as const) {
  test(`copying a regular ${type} preserves value, relations, tags and note with an independent identity`, async () => {
    const f = copyFixture({ type, amount: type === "income" ? "100.01" : "-100.01" });
    const before = structuredClone(f.source);
    const copied = await f.service.copyTransaction(transactionId, userId);
    assert.notEqual(copied.recordId, transactionId);
    assert.equal(copied.name, `${f.source.name} (cópia)`);
    assert.equal(copied.displayAmount, 100.01);
    assert.deepEqual(
      f.writes[0][0].map((record) => ({
        userId: record.userId,
        type: record.type,
        amount: record.amount,
        accountId: record.accountId,
        personId: record.personId,
        categoryId: record.categoryId,
        tagIds: record.tagIds,
        note: record.note,
      })),
      [
        {
          userId,
          type,
          amount: f.source.amount,
          accountId: f.source.accountId,
          personId: firstPersonId,
          categoryId: f.source.categoryId,
          tagIds: f.source.tagIds,
          note: "Original note",
        },
      ],
    );
    assert.deepEqual(f.links, [[transactionId, copied.recordId, userId]]);
    assert.deepEqual(f.source, before);
  });
}

test("copying a split expense preserves each person's signed responsibility", async () => {
  const f = copyFixture();
  f.splits.push(
    ...[firstPersonId, secondPersonId].map((personId, index) => ({
      transactionId,
      personId,
      personName: "Person",
      personAvatarUrl: null,
      amount: index === 0 ? "-60.01" : "-39.99",
      plannedAmount: index === 0 ? "-60.01" : "-39.99",
    })),
  );
  await f.service.copyTransaction(transactionId, userId);
  assert.deepEqual(f.writes[0][1], [
    { transactionIndex: 0, personId: firstPersonId, amount: "-60.01" },
    { transactionIndex: 0, personId: secondPersonId, amount: "-39.99" },
  ]);
});

for (const source of [
  { paymentMethod: null, origin: "accountBalanceAdjustment" },
  { origin: "refund" },
  { origin: "invoicePayment" },
  { origin: "invoiceAdjustment" },
] as const) {
  test(`copying ${source.origin} rejects before creating financial records or attachment links`, async () => {
    const f = copyFixture(source);
    await assert.rejects(f.service.copyTransaction(transactionId, userId), {
      status: 400,
      code:
        source.origin === "accountBalanceAdjustment"
          ? "BALANCE_ADJUSTMENT_IMMUTABLE"
          : "GENERATED_TRANSACTION_IMMUTABLE",
    });
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.links, []);
  });
}

for (const missing of ["transaction", "account", "person", "tag"] as const) {
  test(`copying rejects a missing or unowned ${missing} before writing`, async () => {
    const f = copyFixture();
    if (missing === "transaction")
      Object.assign(f.dependencies, { findTransactionByIdForUser: async () => undefined });
    if (missing === "account")
      Object.assign(f.dependencies, { findAccountByIdForUser: async () => undefined });
    if (missing === "person")
      Object.assign(f.dependencies, { findPersonByIdForUser: async () => undefined });
    if (missing === "tag") f.dependencies.listTagsByIdsForUser = async () => [];
    await assert.rejects(f.service.copyTransaction(transactionId, userId), {
      status: 404,
      code: {
        transaction: "TRANSACTION_NOT_FOUND",
        account: "ACCOUNT_NOT_FOUND",
        person: "PERSON_NOT_FOUND",
        tag: "tag_not_found",
      }[missing],
    });
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.links, []);
  });
}

for (const failureMode of ["empty", "exception"] as const) {
  test(`copy persistence ${failureMode} never creates attachment links or modifies the source`, async () => {
    const f = copyFixture();
    const before = structuredClone(f.source);
    const failure = new Error("Database unavailable");
    f.dependencies.insertTransactionsWithSplits = async () => {
      if (failureMode === "exception") throw failure;
      return [];
    };
    await assert.rejects(
      f.service.copyTransaction(transactionId, userId),
      failureMode === "exception"
        ? (error) => error === failure
        : { code: "TRANSACTION_NOT_FOUND" },
    );
    assert.deepEqual(f.links, []);
    assert.deepEqual(f.source, before);
  });
}

function recurringCopyFixture() {
  const f = copyFixture();
  const rule: RecurringRuleWithRelations = {
    id: recurringRuleId,
    userId,
    seriesId: "b0000000-0000-4000-8000-00000000000b",
    personId: firstPersonId,
    type: "expense",
    paymentMethod: "pix",
    name: "Rent",
    amount: "-100.01",
    anchorDate: new Date("2026-10-01"),
    startDate: new Date("2026-10-01"),
    endDate: new Date("2026-10-31"),
    recurrenceEndDate: new Date("2027-10-01"),
    frequency: "monthly",
    accountId: f.source.accountId,
    cardId: null,
    categoryId: f.source.categoryId,
    tagIds: f.source.tagIds,
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: new Date("2026-10-10"),
    isSettled: false,
    note: "Recurring note",
    status: "paused",
    createdAt: new Date("2026-10-01"),
    updatedAt: new Date("2026-10-01"),
    personName: "Owner",
    personAvatarUrl: null,
    accountName: "Checking",
    accountLogo: null,
    cardName: null,
    cardLogo: null,
    categoryName: "Home",
    categoryIcon: null,
    sourceAccountName: null,
    sourceAccountLogo: null,
    destinationAccountName: null,
    destinationAccountLogo: null,
    cardClosingDay: null,
    cardClosingRuleType: null,
    cardClosingOffsetDays: null,
    cardClosingOffsetMode: null,
    cardClosingDayPurchasesNextInvoice: null,
    cardDueDay: null,
    occurrenceOverrides: {
      "2026-10-01": { isSettled: true, amount: "-90.01", settledDate: "2026-10-02" },
    },
  };
  const writes: Parameters<TransactionsServiceDependencies["insertRecurringRuleWithSplits"]>[] = [];
  Object.assign(f.dependencies, {
    findRecurringRuleByIdForUser: async (id: string, owner: string) => {
      assert.equal(id, recurringRuleId);
      assert.equal(owner, userId);
      return {
        ...rule,
        tagIds: rule.tagIds ?? [],
        dueDateRuleExcluded: rule.dueDateRuleExcluded ?? false,
        recurrenceEndDate: rule.recurrenceEndDate ?? null,
      };
    },
  });
  f.dependencies.listRecurringSplitsForUser = async (ids, owner) => {
    assert.deepEqual(ids, [recurringRuleId]);
    assert.equal(owner, userId);
    return [firstPersonId, secondPersonId].map((personId, index) => ({
      recurringRuleId,
      personId,
      personName: "Person",
      personAvatarUrl: null,
      amount: index === 0 ? "-60.01" : "-40.00",
    }));
  };
  Object.assign(f.dependencies, {
    insertRecurringRuleWithSplits: async (
      ...args: Parameters<TransactionsServiceDependencies["insertRecurringRuleWithSplits"]>
    ) => {
      writes.push(args);
      return {
        ...rule,
        ...args[0],
        id: "c0000000-0000-4000-8000-00000000000c",
        seriesId: "d0000000-0000-4000-8000-00000000000d",
        occurrenceOverrides: {},
        tagIds: args[0].tagIds ?? [],
        dueDateRuleExcluded: args[0].dueDateRuleExcluded ?? false,
        recurrenceEndDate: args[0].recurrenceEndDate ?? null,
      };
    },
  });
  return {
    ...f,
    rule,
    recurringWrites: writes,
    get service() {
      return createTransactionsService(f.dependencies, {
        cleanupOrphans: async () => ({ deletedCount: 0 }),
      });
    },
  };
}

test("copying a recurring rule starts an independent active series without settlement or version history", async () => {
  const f = recurringCopyFixture();
  const before = structuredClone(f.rule);
  const copied = await f.service.copyRecurringRule(recurringRuleId, userId);
  const [draft, shares] = f.recurringWrites[0];
  assert.equal(copied.isRecurring, true);
  assert.notEqual(copied.recurringRuleId, recurringRuleId);
  assert.equal(copied.displayAmount, 100.01);
  assert.equal(copied.isSettled, false);
  assert.deepEqual(
    {
      name: draft.name,
      amount: draft.amount,
      frequency: draft.frequency,
      endDate: draft.endDate,
      recurrenceEndDate: draft.recurrenceEndDate,
      status: draft.status,
      tagIds: draft.tagIds,
      note: draft.note,
    },
    {
      name: "Rent (cópia)",
      amount: "-100.01",
      frequency: "monthly",
      endDate: null,
      recurrenceEndDate: new Date("2027-10-01"),
      status: "active",
      tagIds: f.rule.tagIds,
      note: "Recurring note",
    },
  );
  assert.deepEqual(shares, [
    { personId: firstPersonId, amount: "-60.01" },
    { personId: secondPersonId, amount: "-40.00" },
  ]);
  assert.deepEqual(f.rule, before);
  assert.deepEqual(f.links, []);
});

for (const failureMode of ["missing", "empty", "exception"] as const) {
  test(`recurring copy ${failureMode} fails without modifying the original series`, async () => {
    const f = recurringCopyFixture();
    const before = structuredClone(f.rule);
    const failure = new Error("Database unavailable");
    if (failureMode === "missing")
      Object.assign(f.dependencies, { findRecurringRuleByIdForUser: async () => undefined });
    else
      Object.assign(f.dependencies, {
        insertRecurringRuleWithSplits: async () => {
          if (failureMode === "exception") throw failure;
          return undefined;
        },
      });
    await assert.rejects(
      f.service.copyRecurringRule(recurringRuleId, userId),
      failureMode === "exception"
        ? (error) => error === failure
        : {
            code:
              failureMode === "missing"
                ? "RECURRING_RULE_NOT_FOUND"
                : "RECURRING_TRANSACTION_NOT_FOUND",
          },
    );
    assert.deepEqual(f.rule, before);
    assert.deepEqual(f.recurringWrites, []);
  });
}

test("copying an installment purchase creates an independent series with conserved totals and shares", async () => {
  const originalSeriesId = "b0000000-0000-4000-8000-00000000000b";
  const f = copyFixture({
    condition: "installment",
    installmentCount: 3,
    currentInstallment: 2,
    seriesId: originalSeriesId,
    amount: "-50.00",
  });
  f.splits.push(
    ...[firstPersonId, secondPersonId].map((personId) => ({
      transactionId,
      personId,
      personName: "Person",
      personAvatarUrl: null,
      amount: "-25.00",
      plannedAmount: "-25.00",
    })),
  );
  let recorded:
    | Parameters<TransactionsServiceDependencies["insertInstallmentSeriesWithTransactions"]>
    | undefined;
  f.dependencies.insertInstallmentSeriesWithTransactions = async (...args) => {
    recorded = args;
    return args[1].map((record, index) => ({
      ...f.source,
      ...record,
      tagIds: record.tagIds ?? [],
      plannedAmount: record.amount,
      settledAmount: null,
      settledDate: null,
      dueDateRuleExcluded: false,
      frozenDueDate: null,
      dueDateAdjustment: null,
      categoryName: "Category",
      id: `e0000000-0000-4000-8000-00000000000${index}`,
    }));
  };
  const copied = await f.service.copyTransaction(transactionId, userId);
  assert.ok(recorded);
  const [series, records, shares] = recorded;
  assert.notEqual(series.id, originalSeriesId);
  assert.equal(series.userId, userId);
  assert.equal(series.originalAmount, "150.00");
  assert.equal(series.trackedFromInstallment, 1);
  assert.deepEqual(
    records.map((record) => [record.currentInstallment, record.amount]),
    [
      [1, "-50.00"],
      [2, "-50.00"],
      [3, "-50.00"],
    ],
  );
  assert.ok(records.every((record) => record.seriesId === series.id));
  assert.equal(
    shares.reduce((total, share) => total + Math.round(Number(share.amount) * 100), 0),
    -15000,
  );
  for (const personId of [firstPersonId, secondPersonId]) {
    assert.equal(
      shares
        .filter((share) => share.personId === personId)
        .reduce((sum, share) => sum + Math.round(Number(share.amount) * 100), 0),
      -7500,
    );
  }
  assert.deepEqual(f.links, [[transactionId, copied.recordId, userId]]);
  assert.equal(f.source.seriesId, originalSeriesId);
});

test("copying a card purchase rejects a paid invoice before inserting the copy or its links", async () => {
  const f = copyFixture({
    paymentMethod: "credit_card",
    accountId: null,
    cardId: "f0000000-0000-4000-8000-00000000000f",
    isSettled: null,
  });
  f.dependencies.listPaidInvoicePeriodsForUser = async () => [{ period: "2026-10" }];
  await assert.rejects(f.service.copyTransaction(transactionId, userId), {
    code: "INVOICE_ALREADY_PAID",
  });
  assert.deepEqual(f.writes, []);
  assert.deepEqual(f.links, []);
});

for (const selectedAmount of ["-33.34", "-33.33"]) {
  test(`copying a rounded installment ${selectedAmount} preserves the original purchase total`, async () => {
    const f = copyFixture({
      condition: "installment",
      installmentCount: 3,
      currentInstallment: 1,
      seriesId: "b0000000-0000-4000-8000-00000000000b",
      amount: selectedAmount,
    });
    f.dependencies.findInstallmentSeriesByIdForUser = async (id, owner) => {
      assert.equal(id, f.source.seriesId);
      assert.equal(owner, userId);
      return { originalAmount: "100.01" };
    };
    let copiedTotal = 0;
    f.dependencies.insertInstallmentSeriesWithTransactions = async (_series, records) => {
      copiedTotal = records.reduce(
        (total, record) => total + Math.round(Math.abs(Number(record.amount)) * 100),
        0,
      );
      return records.map((record, index) => ({
        ...f.source,
        ...record,
        tagIds: record.tagIds ?? [],
        plannedAmount: record.amount,
        settledAmount: null,
        settledDate: null,
        dueDateRuleExcluded: false,
        frozenDueDate: null,
        dueDateAdjustment: null,
        categoryName: "Category",
        id: `e0000000-0000-4000-8000-00000000000${index}`,
      }));
    };
    const copy = await f.service.copyTransaction(transactionId, userId);
    assert.equal(copiedTotal, 10001);
    assert.notEqual(copy.seriesId, f.source.seriesId);
    assert.deepEqual(f.links, [[transactionId, copy.recordId, userId]]);
  });
}

for (const missingSeries of [false, true]) {
  test(`an installment copy rejects unavailable series metadata (missing ID: ${missingSeries}) before writes`, async () => {
    const f = copyFixture({
      condition: "installment",
      installmentCount: 3,
      seriesId: missingSeries ? null : "b0000000-0000-4000-8000-00000000000b",
    });
    Object.assign(f.dependencies, { findInstallmentSeriesByIdForUser: async () => undefined });
    await assert.rejects(f.service.copyTransaction(transactionId, userId), {
      status: 404,
      code: "INSTALLMENT_SERIES_NOT_FOUND",
    });
    assert.deepEqual(f.writes, []);
    assert.deepEqual(f.links, []);
  });
}

function createBulkService(overrides: Record<string, unknown>) {
  const cleanups: string[] = [];
  const dependencies = new Proxy(overrides, {
    get(target, property) {
      if (property in target) return target[property as keyof typeof target];
      return async () => {
        throw new Error(`Unexpected dependency call: ${String(property)}`);
      };
    },
  }) as unknown as TransactionsServiceDependencies;
  const service = createTransactionsService(dependencies, {
    async cleanupOrphans(owner: string) {
      cleanups.push(owner);
      return { deletedCount: 0 };
    },
  });
  return { service, cleanups };
}

function bulkTarget(id: string, patch: Record<string, unknown> = {}) {
  return {
    id,
    origin: "regular",
    type: "expense",
    paymentMethod: "pix",
    cardId: null,
    isSettled: false,
    refundedAmount: "0",
    tagIds: [],
    ...patch,
  };
}

const secondTransactionId = "20000000-0000-4000-8000-000000000003";
const bulkCategoryId = "60000000-0000-4000-8000-000000000006";
const bulkTagId = "80000000-0000-4000-8000-000000000008";

test("bulk categorization updates only owned transactions compatible with the category", async () => {
  const updates: unknown[] = [];
  const { service } = createBulkService({
    listCategoriesByIdsForUser: async () => [
      { id: bulkCategoryId, name: "Lazer", type: "expense", isSystem: false },
    ],
    listBulkTransactionTargetsForUser: async (ids: string[]) => ids.map((id) => bulkTarget(id)),
    updateTransactionsCategoryForUser: async (ids: string[], owner: string, categoryId: string) => {
      updates.push({ ids, owner, categoryId });
      return ids;
    },
  });

  const result = await service.categorizeTransactions(
    { ids: [transactionId, secondTransactionId, transactionId], categoryId: bulkCategoryId },
    userId,
  );

  assert.deepEqual(result, { ids: [transactionId, secondTransactionId] });
  assert.deepEqual(updates, [
    { ids: [transactionId, secondTransactionId], owner: userId, categoryId: bulkCategoryId },
  ]);
});

test("bulk categorization rejects mismatched types and foreign transactions", async () => {
  const { service: incompatible } = createBulkService({
    listCategoriesByIdsForUser: async () => [
      { id: bulkCategoryId, name: "Salário", type: "income", isSystem: false },
    ],
    listBulkTransactionTargetsForUser: async (ids: string[]) => ids.map((id) => bulkTarget(id)),
  });
  await assert.rejects(
    incompatible.categorizeTransactions(
      { ids: [transactionId], categoryId: bulkCategoryId },
      userId,
    ),
    { code: "BULK_CATEGORY_INCOMPATIBLE" },
  );

  const { service: foreign } = createBulkService({
    listCategoriesByIdsForUser: async () => [
      { id: bulkCategoryId, name: "Lazer", type: "expense", isSystem: false },
    ],
    listBulkTransactionTargetsForUser: async () => [bulkTarget(transactionId)],
  });
  await assert.rejects(
    foreign.categorizeTransactions(
      { ids: [transactionId, secondTransactionId], categoryId: bulkCategoryId },
      userId,
    ),
    { code: "TRANSACTION_NOT_FOUND" },
  );
});

test("bulk tagging adds within the limit and removes owned tags", async () => {
  const calls: unknown[] = [];
  const { service } = createBulkService({
    listTagsByIdsForUser: async (ids: string[]) => ids.map((id) => ({ id })),
    listBulkTransactionTargetsForUser: async (ids: string[]) => ids.map((id) => bulkTarget(id)),
    addTransactionsTagsForUser: async (ids: string[], _owner: string, tagIds: string[]) => {
      calls.push({ operation: "add", ids, tagIds });
      return ids;
    },
    removeTransactionsTagsForUser: async (ids: string[], _owner: string, tagIds: string[]) => {
      calls.push({ operation: "remove", ids, tagIds });
      return ids;
    },
  });

  await service.tagTransactions(
    { ids: [transactionId], operation: "add", tagIds: [bulkTagId] },
    userId,
  );
  await service.tagTransactions(
    { ids: [transactionId], operation: "remove", tagIds: [bulkTagId] },
    userId,
  );
  assert.deepEqual(calls, [
    { operation: "add", ids: [transactionId], tagIds: [bulkTagId] },
    { operation: "remove", ids: [transactionId], tagIds: [bulkTagId] },
  ]);

  const { service: full } = createBulkService({
    listTagsByIdsForUser: async (ids: string[]) => ids.map((id) => ({ id })),
    listBulkTransactionTargetsForUser: async (ids: string[]) =>
      ids.map((id) =>
        bulkTarget(id, {
          tagIds: Array.from({ length: 20 }, (_, index) => `existing-${index}`),
        }),
      ),
  });
  await assert.rejects(
    full.tagTransactions({ ids: [transactionId], operation: "add", tagIds: [bulkTagId] }, userId),
    { code: "TAG_LIMIT_EXCEEDED" },
  );
});

test("bulk deletion is all-or-nothing for generated or refunded transactions", async () => {
  const deleted: string[][] = [];
  const { service, cleanups } = createBulkService({
    listBulkTransactionTargetsForUser: async (ids: string[]) => ids.map((id) => bulkTarget(id)),
    deleteTransactionsForUser: async (ids: string[]) => {
      deleted.push(ids);
      return ids;
    },
  });
  assert.deepEqual(await service.deleteTransactions({ ids: [transactionId] }, userId), {
    ids: [transactionId],
  });
  assert.deepEqual(deleted, [[transactionId]]);
  assert.deepEqual(cleanups, [userId]);

  const { service: refunded } = createBulkService({
    listBulkTransactionTargetsForUser: async () => [
      bulkTarget(transactionId),
      bulkTarget(secondTransactionId, { refundedAmount: "10.00" }),
    ],
  });
  await assert.rejects(
    refunded.deleteTransactions({ ids: [transactionId, secondTransactionId] }, userId),
    { code: "BULK_ACTION_UNSUPPORTED" },
  );
});

test("bulk renaming applies individual names only to editable transactions", async () => {
  const renamed: unknown[] = [];
  const { service } = createBulkService({
    listBulkTransactionTargetsForUser: async (ids: string[]) => ids.map((id) => bulkTarget(id)),
    renameTransactionsForUser: async (items: Array<{ id: string; name: string }>) => {
      renamed.push(items);
      return items.map((item) => item.id);
    },
  });
  const items = [
    { id: transactionId, name: "Mercado" },
    { id: secondTransactionId, name: "Farmácia" },
  ];

  assert.deepEqual(await service.renameTransactions({ items }, userId), {
    ids: [transactionId, secondTransactionId],
  });
  assert.deepEqual(renamed, [items]);

  const { service: generated } = createBulkService({
    listBulkTransactionTargetsForUser: async () => [
      bulkTarget(transactionId, { origin: "invoicePayment" }),
    ],
  });
  await assert.rejects(
    generated.renameTransactions({ items: [{ id: transactionId, name: "Fatura" }] }, userId),
    { code: "BULK_ACTION_UNSUPPORTED" },
  );
});

test("bulk HTTP contract validates operation-specific payloads", async () => {
  const { service } = createBulkService({});
  const route = createTransactionsRoute(service);
  const send = (path: string, method: string, body: unknown) =>
    route.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

  assert.equal((await send("/bulk/category", "PATCH", { ids: [] })).status, 400);
  assert.equal(
    (
      await send("/bulk/tags", "PATCH", {
        ids: [transactionId],
        operation: "rename",
        tagIds: [bulkTagId],
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await send("/bulk/names", "PATCH", {
        items: [
          { id: transactionId, name: "A" },
          { id: transactionId, name: "B" },
        ],
      })
    ).status,
    400,
  );
  assert.equal(
    (await send("/bulk/names", "PATCH", { items: [{ id: transactionId, name: "   " }] })).status,
    400,
  );
  assert.equal(
    (await send("/bulk/delete", "POST", { ids: [transactionId], categoryId: bulkCategoryId }))
      .status,
    400,
  );
});
