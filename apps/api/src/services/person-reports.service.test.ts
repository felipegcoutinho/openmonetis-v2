import assert from "node:assert/strict";
import test from "node:test";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { ApiError } from "../utils/errors";
import {
  createPersonReportsService,
  type EmailMessage,
  type PersonReportDeliveriesRepository,
  type PersonReportDeliveryRecord,
  type PersonReportScheduleRecord,
  type PersonReportSchedulesRepository,
  type PersonReportsDependencies,
} from "./person-reports.service";

const personId = "6c1f0d4e-8a4b-4c1f-9a2e-222222222222";

const sharedPurchase = {
  id: "purchase",
  name: "Restaurante",
  purchaseDate: "2026-10-12",
  amount: -200,
  allocation: { personId, personName: "Camila", personAvatarUrl: null, amount: -80 },
  origin: "regular",
  type: "expense",
  paymentMethod: "credit_card",
  cardId: "6c1f0d4e-8a4b-4c1f-9a2e-333333333333",
  cardName: "Inter",
  cardLogo: "/logos/intermedium.png",
  categoryId: null,
  categoryName: null,
  categoryIcon: null,
  currentInstallment: 2,
  installmentCount: 6,
  isRecurring: false,
  accountName: "Conta corrente",
  note: "observação privada",
} as unknown as TransactionOutput;

const camila = {
  id: personId,
  name: "Camila",
  email: "camila@example.com",
  role: "external",
  status: "active",
} as const;

function createDeliveriesRepository(clock = () => new Date("2026-11-07T12:00:00.000Z")) {
  const records: PersonReportDeliveryRecord[] = [];
  const repository: PersonReportDeliveriesRepository = {
    insertDelivery: async (data) => {
      const record: PersonReportDeliveryRecord = {
        ...data,
        id: `6c1f0d4e-8a4b-4c1f-9a2e-${String(555555555555 + records.length)}`,
        status: "pending",
        attempts: 0,
        providerMessageId: null,
        errorCode: null,
        scheduledFor: data.scheduledFor ?? null,
        createdAt: clock(),
        sentAt: null,
        updatedAt: clock(),
      };
      records.push(record);
      return record;
    },
    updateDeliveryForUser: async (id, userId, data) => {
      const record = records.find((item) => item.id === id && item.userId === userId);
      if (!record) return null;
      Object.assign(record, data, { updatedAt: clock() });
      return record;
    },
    listDeliveriesForPerson: async (id, userId) =>
      records.filter((item) => item.personId === id && item.userId === userId),
    findScheduledDelivery: async (id, userId, scheduledFor) =>
      records.find(
        (item) =>
          item.personId === id && item.userId === userId && item.scheduledFor === scheduledFor,
      ) ?? null,
  };
  return { records, repository };
}

function createSchedulesRepository(initial: PersonReportScheduleRecord[] = []) {
  const schedules = [...initial];
  const state = { lastCompletedRunDate: null as string | null };
  const repository: PersonReportSchedulesRepository = {
    findScheduleForPerson: async (id, userId) =>
      schedules.find((item) => item.personId === id && item.userId === userId) ?? null,
    upsertSchedule: async (data) => {
      const index = schedules.findIndex((item) => item.personId === data.personId);
      const record = { ...data, updatedAt: new Date("2026-11-07T12:00:00.000Z") };
      if (index >= 0) schedules[index] = record;
      else schedules.push(record);
      return record;
    },
    listEnabledSchedules: async () => schedules.filter((item) => item.enabled),
    findLastCompletedRunDate: async () => state.lastCompletedRunDate,
    markRunCompleted: async (date) => {
      state.lastCompletedRunDate = date;
    },
  };
  return { schedules, state, repository };
}

const mondaySchedule: PersonReportScheduleRecord = {
  userId: "user-1",
  personId,
  enabled: true,
  frequency: "weekly",
  weekday: 1,
  monthDays: [],
  reportPeriod: "previous",
  includeSpreadsheet: false,
  updatedAt: new Date("2026-11-01T12:00:00.000Z"),
};

function dependencies(
  overrides: Partial<PersonReportsDependencies> = {},
): PersonReportsDependencies {
  return {
    findPerson: async () => camila,
    findAccountOwner: async () => ({ name: "Felipe", email: "felipe@example.com" }),
    deliveries: createDeliveriesRepository().repository,
    schedules: createSchedulesRepository().repository,
    emailSender: { enabled: true, send: async () => ({ providerMessageId: "resend-id" }) },
    now: () => new Date("2026-11-07T12:00:05.000Z"),
    logDeliveryFailure: () => undefined,
    listPersonTransactions: async (_userId, query) =>
      query.period === "2026-10" ? [sharedPurchase] : [],
    listCardDueDates: async () => [
      { cardId: "6c1f0d4e-8a4b-4c1f-9a2e-333333333333", dueDate: "2026-10-10" },
    ],
    listPersonSettlements: async () => [
      {
        id: "6c1f0d4e-8a4b-4c1f-9a2e-444444444444",
        personId,
        amount: 50,
        receivedAt: "2026-10-20",
        note: "pix",
        source: "manual",
        createdAt: "2026-10-20T12:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

test("reports the person's share of shared expenses, filtered by person and period", async () => {
  const receivedQueries: Parameters<PersonReportsDependencies["listPersonTransactions"]>[1][] = [];
  const service = createPersonReportsService(
    dependencies({
      listPersonTransactions: async (_userId, query) => {
        receivedQueries.push(query);
        return [sharedPurchase];
      },
    }),
  );

  const report = await service.getReport(personId, "user-1", "2026-10");

  assert.equal(receivedQueries[0]?.period, "2026-10");
  assert.deepEqual(receivedQueries[0]?.personIds, [personId]);
  assert.deepEqual(report.person, { id: personId, name: "Camila" });
  assert.equal(report.groups[0]?.cardName, "Inter");
  assert.equal(report.groups[0]?.lines[0]?.amount, 80);
  assert.equal(report.groups[0]?.lines[0]?.currentInstallment, 2);
  assert.equal(report.balance.receivableAmount, 30);
  assert.deepEqual(Object.keys(report.settlements[0] ?? {}).sort(), [
    "amount",
    "id",
    "receivedAt",
    "source",
  ]);
});

test("never exposes account names or private notes", async () => {
  const report = await createPersonReportsService(dependencies()).getReport(
    personId,
    "user-1",
    "2026-10",
  );
  const serialized = JSON.stringify(report);

  assert.equal(serialized.includes("Conta corrente"), false);
  assert.equal(serialized.includes("observação privada"), false);
  assert.equal(serialized.includes("user-1"), false);
});

test("rejects unknown people and the account owner", async () => {
  await assert.rejects(
    createPersonReportsService(dependencies({ findPerson: async () => null })).getReport(
      personId,
      "user-1",
      "2026-10",
    ),
    (error) => error instanceof ApiError && error.code === "person_not_found",
  );
  await assert.rejects(
    createPersonReportsService(
      dependencies({ findPerson: async () => ({ ...camila, name: "Eu", role: "admin" }) }),
    ).getReport(personId, "user-1", "2026-10"),
    (error) => error instanceof ApiError && error.code === "person_report_admin_not_allowed",
  );
});

test("emails the report to the person with the owner as reply-to", async () => {
  const sent: EmailMessage[] = [];
  const { records, repository } = createDeliveriesRepository();
  const service = createPersonReportsService(
    dependencies({
      deliveries: repository,
      emailSender: {
        enabled: true,
        send: async (message) => {
          sent.push(message);
          return { providerMessageId: "resend-id" };
        },
      },
      emailAssets: {
        readImage: async (path) =>
          path === "/logos/intermedium.png"
            ? { contentBase64: "iVBORw==", contentType: "image/png" }
            : null,
      },
    }),
  );

  const delivery = await service.sendReport(personId, "user-1", {
    period: "2026-10",
    message: "Oi! Segue o resumo <b>do mês</b>.",
    includeSpreadsheet: true,
  });

  assert.equal(delivery.status, "sent");
  assert.equal(delivery.trigger, "manual");
  assert.equal(delivery.sentAt, "2026-11-07T12:00:05.000Z");
  assert.equal(records[0]?.providerMessageId, "resend-id");
  assert.equal(records[0]?.attempts, 1);
  assert.equal(sent[0]?.to, "camila@example.com");
  assert.equal(sent[0]?.replyTo, "felipe@example.com");
  assert.equal(sent[0]?.idempotencyKey, delivery.id);
  assert.equal(sent[0]?.subject, "Resumo de despesas de Outubro de 2026 · Felipe");
  assert.equal(sent[0]?.html.includes("<b>do mês</b>"), false);
  assert.equal(sent[0]?.html.includes("&lt;b&gt;do mês&lt;/b&gt;"), true);
  assert.equal(sent[0]?.html.includes("Conta corrente"), false);
  assert.deepEqual(
    sent[0]?.attachments?.map(({ fileName, contentId }) => ({ fileName, contentId })),
    [
      { fileName: "intermedium.png", contentId: "om-logos-intermedium.png" },
      { fileName: "extrato-2026-10.xlsx", contentId: undefined },
    ],
  );
  assert.equal(sent[0]?.html.includes("cid:om-logos-intermedium.png"), true);
  assert.equal(sent[0]?.html.includes("cid:om-icon-192.png"), false);
  assert.equal(Object.keys(delivery).includes("providerMessageId"), false);
});

test("records a failed delivery and answers with a generic error", async () => {
  const logged: string[] = [];
  const { records, repository } = createDeliveriesRepository();
  const service = createPersonReportsService(
    dependencies({
      deliveries: repository,
      emailSender: {
        enabled: true,
        send: async () => {
          throw new Error("provider down");
        },
      },
      logDeliveryFailure: (deliveryId) => logged.push(deliveryId),
    }),
  );

  await assert.rejects(
    service.sendReport(personId, "user-1", { period: "2026-10" }),
    (error) => error instanceof ApiError && error.code === "email_delivery_failed",
  );
  assert.equal(records[0]?.status, "failed");
  assert.equal(records[0]?.errorCode, "provider_error");
  assert.deepEqual(logged, [records[0]?.id]);
});

test("does not send when email is not configured or the person cannot receive it", async () => {
  const send = async () => {
    throw new Error("must not send");
  };
  await assert.rejects(
    createPersonReportsService(dependencies({ emailSender: { enabled: false, send } })).sendReport(
      personId,
      "user-1",
      { period: "2026-10" },
    ),
    (error) => error instanceof ApiError && error.code === "email_not_configured",
  );

  for (const [overrides, code] of [
    [{ findPerson: async () => ({ ...camila, email: null }) }, "person_email_missing"],
    [{ findPerson: async () => ({ ...camila, status: "inactive" as const }) }, "person_inactive"],
    [{ listPersonTransactions: async () => [] }, "person_report_empty"],
  ] as const) {
    await assert.rejects(
      createPersonReportsService(
        dependencies({ ...overrides, emailSender: { enabled: true, send } }),
      ).sendReport(personId, "user-1", { period: "2026-10" }),
      (error) => error instanceof ApiError && error.code === code,
    );
  }
});

test("lists deliveries with the email availability of the installation", async () => {
  const { repository } = createDeliveriesRepository();
  const service = createPersonReportsService(dependencies({ deliveries: repository }));
  await service.sendReport(personId, "user-1", { period: "2026-10" });

  const result = await service.listDeliveries(personId, "user-1");

  assert.equal(result.emailEnabled, true);
  assert.deepEqual(
    result.deliveries.map((delivery) => [delivery.period, delivery.status]),
    [["2026-10", "sent"]],
  );
});

test("saves a schedule and lists its next sending dates", async () => {
  const service = createPersonReportsService(dependencies());

  const state = await service.updateSchedule(personId, "user-1", {
    enabled: true,
    frequency: "semimonthly",
    weekday: 4,
    monthDays: [16, 1],
    reportPeriod: "current",
    includeSpreadsheet: false,
  });

  assert.deepEqual(state.schedule?.monthDays, [1, 16]);
  assert.equal(state.schedule?.weekday, null);
  assert.equal(state.sendingHour, 8);
  // 2026-11-07 12:00 UTC is 09:00 in Brasília, after the sending hour, so today is not listed.
  assert.deepEqual(state.nextDeliveryDates, ["2026-11-16", "2026-12-01", "2026-12-16"]);
});

test("does not enable a schedule for a person who cannot receive email", async () => {
  await assert.rejects(
    createPersonReportsService(
      dependencies({ findPerson: async () => ({ ...camila, email: null }) }),
    ).updateSchedule(personId, "user-1", {
      enabled: true,
      frequency: "monthly",
      weekday: null,
      monthDays: [1],
      reportPeriod: "previous",
      includeSpreadsheet: false,
    }),
    (error) => error instanceof ApiError && error.code === "person_email_missing",
  );
});

test("sends due scheduled reports once per person and date", async () => {
  const sent: EmailMessage[] = [];
  const deliveries = createDeliveriesRepository();
  const schedules = createSchedulesRepository([mondaySchedule]);
  const receivedPeriods: string[] = [];
  const service = createPersonReportsService(
    dependencies({
      // Monday, 2026-11-09 at 09:00 in Brasília.
      now: () => new Date("2026-11-09T12:00:00.000Z"),
      deliveries: deliveries.repository,
      schedules: schedules.repository,
      listPersonTransactions: async (_userId, query) => {
        receivedPeriods.push(query.period as string);
        return [sharedPurchase];
      },
      emailSender: {
        enabled: true,
        send: async (message) => {
          sent.push(message);
          return { providerMessageId: "resend-id" };
        },
      },
    }),
  );

  assert.deepEqual(await service.runScheduledDeliveries(), {
    sent: 1,
    failed: 0,
    skipped: 0,
    retrying: 0,
  });
  assert.equal(await service.runScheduledDeliveries(), null);
  schedules.state.lastCompletedRunDate = null;
  assert.deepEqual(await service.runScheduledDeliveries(), {
    sent: 0,
    failed: 0,
    skipped: 0,
    retrying: 0,
  });

  assert.equal(sent.length, 1);
  // The month itself, the previous one and the three coming months.
  assert.deepEqual(receivedPeriods, ["2026-10", "2026-09", "2026-11", "2026-12", "2027-01"]);
  assert.equal(deliveries.records[0]?.trigger, "scheduled");
  assert.equal(deliveries.records[0]?.scheduledFor, "2026-11-09");
  assert.equal(sent[0]?.subject, "Resumo de despesas de Outubro de 2026 · Felipe");
});

test("waits for the sending hour and retries failed scheduled deliveries later", async () => {
  let current = new Date("2026-11-09T10:00:00.000Z"); // 07:00 in Brasília
  let failing = true;
  const deliveries = createDeliveriesRepository(() => current);
  const schedules = createSchedulesRepository([{ ...mondaySchedule, reportPeriod: "current" }]);
  const service = createPersonReportsService(
    dependencies({
      now: () => current,
      listPersonTransactions: async () => [sharedPurchase],
      deliveries: deliveries.repository,
      schedules: schedules.repository,
      emailSender: {
        enabled: true,
        send: async () => {
          if (failing) throw new Error("provider down");
          return { providerMessageId: "resend-id" };
        },
      },
    }),
  );

  assert.equal(await service.runScheduledDeliveries(), null);

  current = new Date("2026-11-09T11:00:00.000Z");
  assert.equal((await service.runScheduledDeliveries())?.retrying, 1);
  assert.equal(schedules.state.lastCompletedRunDate, null);

  current = new Date("2026-11-09T11:05:00.000Z");
  assert.equal((await service.runScheduledDeliveries())?.retrying, 1);
  assert.equal(deliveries.records[0]?.attempts, 1);

  failing = false;
  current = new Date("2026-11-09T11:20:00.000Z");
  assert.equal((await service.runScheduledDeliveries())?.sent, 1);
  assert.equal(deliveries.records.length, 1);
  assert.equal(deliveries.records[0]?.status, "sent");
  assert.equal(deliveries.records[0]?.attempts, 2);
  assert.equal(schedules.state.lastCompletedRunDate, "2026-11-09");
});

test("skips scheduled reports without expenses and people without email", async () => {
  const schedules = createSchedulesRepository([mondaySchedule]);
  const service = createPersonReportsService(
    dependencies({
      now: () => new Date("2026-11-09T12:00:00.000Z"),
      schedules: schedules.repository,
      listPersonTransactions: async () => [],
    }),
  );

  assert.deepEqual(await service.runScheduledDeliveries(), {
    sent: 0,
    failed: 0,
    skipped: 1,
    retrying: 0,
  });
});

test("compares with the previous month and lists the commitments ahead", async () => {
  const service = createPersonReportsService(
    dependencies({
      listPersonTransactions: async (_userId, query) => {
        if (query.period === "2026-10") return [sharedPurchase];
        if (query.period === "2026-09")
          return [{ ...sharedPurchase, allocation: null, amount: -40 }];
        if (query.period === "2026-11") {
          return [{ ...sharedPurchase, currentInstallment: 3, installmentCount: 6 }];
        }
        return [];
      },
    }),
  );

  const report = await service.getReport(personId, "user-1", "2026-10");

  assert.equal(report.groups[0]?.dueDate, "2026-10-10");
  assert.deepEqual(report.comparison, {
    previousPeriod: "2026-09",
    previousAmount: 40,
    differenceAmount: 40,
    changePercentage: 100,
  });
  assert.deepEqual(report.commitments, [
    { period: "2026-11", totalAmount: 80, entryCount: 1, installmentCount: 1, recurringCount: 0 },
  ]);
});

test("renders the emailed statement as a printable document without sending it", async () => {
  const send = async () => {
    throw new Error("must not send");
  };
  const service = createPersonReportsService(
    dependencies({ emailSender: { enabled: true, send } }),
  );
  const document = await service.getReportDocument(personId, "user-1", "2026-10");

  assert.equal(document.title, "Extrato de Camila - Outubro de 2026");
  assert.match(document.html, /<title>Extrato de Camila - Outubro de 2026<\/title>/);
  assert.match(document.html, /@page/);
  assert.equal(document.html.includes("cid:"), false);
  assert.equal(document.html.includes("observação privada"), false);
  assert.deepEqual(await service.listDeliveries(personId, "user-1"), {
    emailEnabled: true,
    deliveries: [],
  });
  await assert.rejects(
    createPersonReportsService(dependencies({ findPerson: async () => null })).getReportDocument(
      personId,
      "user-1",
      "2026-10",
    ),
    (error) => error instanceof ApiError && error.code === "person_not_found",
  );
});
