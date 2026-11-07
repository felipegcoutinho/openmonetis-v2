import {
  buildPersonReport,
  comparePersonReportPeriods,
  findPersonReportDeliveryBlocker,
  firstPersonReportScheduleDate,
  getPreviousPersonReportPeriod,
  isPersonReportPeriodOpen,
  isPersonReportScheduleDue,
  listNextPersonReportScheduleDates,
  listPersonReportCommitmentPeriods,
  maximumScheduledDeliveryAttempts,
  normalizePersonReportScheduleRule,
  type PersonReportDeliveryStatus,
  type PersonReportDeliveryTrigger,
  type PersonReportEntry,
  type PersonReportScheduleFrequency,
  type PersonReportSchedulePeriod,
  personReportScheduleHour,
  resolvePersonReportSchedulePeriod,
  shouldAttemptScheduledDelivery,
  summarizePersonReportCommitment,
} from "@openmonetis/domain/person-reports";
import { getCurrentDateInBrazil, getCurrentHourInBrazil } from "@openmonetis/shared/date-time";
import type {
  CreatePersonReportDeliveryInput,
  PersonReportDeliveriesOutput,
  PersonReportDeliveryOutput,
  PersonReportDocumentOutput,
  PersonReportOutput,
  PersonReportScheduleStateOutput,
  UpdatePersonReportScheduleInput,
} from "@openmonetis/validators/person-reports";
import type { PersonSettlementOutput } from "@openmonetis/validators/person-settlements";
import {
  type ListTransactionsQuery,
  ListTransactionsQuerySchema,
  type TransactionOutput,
} from "@openmonetis/validators/transactions";
import { type EmailAssetReader, isEmailImagePath } from "../utils/email-assets";
import { ApiError, badRequest, notFound } from "../utils/errors";
import {
  buildPersonReportEmail,
  getPersonReportEmailImageId,
  getPersonReportEmailImagePaths,
  inlinePersonReportImageSources,
} from "../utils/person-report-email";
import { formatReportPeriod } from "../utils/person-report-format";
import { createPersonReportSpreadsheet } from "../utils/person-report-spreadsheet";

type PersonReportPerson = {
  id: string;
  name: string;
  email: string | null;
  role: "admin" | "external";
  status: "active" | "inactive";
};

type AccountOwner = { name: string; email: string | null };

export type PersonReportDeliveryRecord = {
  id: string;
  userId: string;
  personId: string;
  period: string;
  trigger: PersonReportDeliveryTrigger;
  status: PersonReportDeliveryStatus;
  recipientEmail: string;
  includesSpreadsheet: boolean;
  attempts: number;
  providerMessageId: string | null;
  errorCode: string | null;
  scheduledFor: string | null;
  createdAt: Date;
  sentAt: Date | null;
  updatedAt: Date;
};

export type PersonReportDeliveriesRepository = {
  insertDelivery(
    data: Pick<
      PersonReportDeliveryRecord,
      "userId" | "personId" | "period" | "trigger" | "recipientEmail" | "includesSpreadsheet"
    > & { scheduledFor?: string | null },
  ): Promise<PersonReportDeliveryRecord>;
  updateDeliveryForUser(
    id: string,
    userId: string,
    data: Partial<
      Pick<
        PersonReportDeliveryRecord,
        "status" | "attempts" | "providerMessageId" | "errorCode" | "sentAt"
      >
    >,
  ): Promise<PersonReportDeliveryRecord | null>;
  listDeliveriesForPerson(
    personId: string,
    userId: string,
    limit: number,
  ): Promise<PersonReportDeliveryRecord[]>;
  findScheduledDelivery(
    personId: string,
    userId: string,
    scheduledFor: string,
  ): Promise<PersonReportDeliveryRecord | null>;
};

export type PersonReportScheduleRecord = {
  userId: string;
  personId: string;
  enabled: boolean;
  frequency: PersonReportScheduleFrequency;
  weekday: number | null;
  monthDays: number[];
  reportPeriod: PersonReportSchedulePeriod;
  includeSpreadsheet: boolean;
  updatedAt: Date;
};

export type PersonReportSchedulesRepository = {
  findScheduleForPerson(
    personId: string,
    userId: string,
  ): Promise<PersonReportScheduleRecord | null>;
  upsertSchedule(
    data: Omit<PersonReportScheduleRecord, "updatedAt">,
  ): Promise<PersonReportScheduleRecord>;
  /**
   * Enabled schedules of every account, for the background worker only. Each one is then handled
   * with its own `userId`, so every later read and write stays scoped to the owner.
   */
  listEnabledSchedules(): Promise<PersonReportScheduleRecord[]>;
  /** Last business date (YYYY-MM-DD) whose scheduled deliveries all finished. */
  findLastCompletedRunDate(): Promise<string | null>;
  markRunCompleted(date: string, completedAt: Date): Promise<void>;
};

export type EmailAttachment = {
  fileName: string;
  contentBase64: string;
  contentType?: string;
  /** Set for images shown inside the HTML through `cid:<contentId>`. */
  contentId?: string;
};

export type EmailMessage = {
  to: string;
  replyTo: string | null;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  /** Lets the provider discard a duplicate request for the same delivery. */
  idempotencyKey: string;
};

export type EmailSender = {
  enabled: boolean;
  send(message: EmailMessage): Promise<{ providerMessageId: string | null }>;
};

export type PersonReportsDependencies = {
  findPerson(personId: string, userId: string): Promise<PersonReportPerson | null>;
  findAccountOwner(userId: string): Promise<AccountOwner | null>;
  /** Every transaction of the period attributed to the person, without pagination. */
  listPersonTransactions(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<TransactionOutput[]>;
  listPersonSettlements(
    personId: string,
    userId: string,
    period: string,
  ): Promise<PersonSettlementOutput[]>;
  /** Effective due date of each card's invoice in the month, with the account's due-date rules. */
  listCardDueDates(userId: string, period: string): Promise<{ cardId: string; dueDate: string }[]>;
  deliveries: PersonReportDeliveriesRepository;
  schedules: PersonReportSchedulesRepository;
  emailSender: EmailSender;
  /** Bundled images embedded in the email; without it the email uses text monograms. */
  emailAssets?: EmailAssetReader;
  now?: () => Date;
  logDeliveryFailure?: (deliveryId: string, error: unknown) => void;
};

export type ScheduledDeliveriesSummary = {
  sent: number;
  failed: number;
  skipped: number;
  /** Deliveries that failed or were interrupted and will be tried again later today. */
  retrying: number;
};

const deliveryHistoryLimit = 10;
const nextDeliveryDatesCount = 3;

function toDeliveryOutput(record: PersonReportDeliveryRecord): PersonReportDeliveryOutput {
  return {
    id: record.id,
    period: record.period,
    trigger: record.trigger,
    status: record.status,
    recipientEmail: record.recipientEmail,
    includesSpreadsheet: record.includesSpreadsheet,
    scheduledFor: record.scheduledFor,
    createdAt: record.createdAt.toISOString(),
    sentAt: record.sentAt?.toISOString() ?? null,
  };
}

function defaultLogDeliveryFailure(deliveryId: string, error: unknown) {
  // Only the delivery id and the provider status: never the recipient or the report content.
  const status =
    error && typeof error === "object" && "status" in error ? (error.status as unknown) : null;
  console.error(JSON.stringify({ event: "person_report_delivery_failed", deliveryId, status }));
}

export function createPersonReportsService(dependencies: PersonReportsDependencies) {
  const now = dependencies.now ?? (() => new Date());
  const logDeliveryFailure = dependencies.logDeliveryFailure ?? defaultLogDeliveryFailure;

  async function loadEmailImages(report: PersonReportOutput) {
    const assets = dependencies.emailAssets;
    if (!assets) return [];
    const images = await Promise.all(
      getPersonReportEmailImagePaths(report).map(async (path) => {
        const image = await assets.readImage(path);
        return image ? { path, image } : null;
      }),
    );
    return images.filter((item) => item !== null);
  }

  async function findExternalPerson(personId: string, userId: string) {
    const person = await dependencies.findPerson(personId, userId);
    if (!person) throw notFound("Person not found", "person_not_found");
    if (person.role !== "external") {
      throw badRequest(
        "Reports are only available for external people",
        "person_report_admin_not_allowed",
      );
    }
    return person;
  }

  function assertEmailConfigured() {
    if (!dependencies.emailSender.enabled) {
      throw new ApiError("Email delivery is not configured", "email_not_configured", 503);
    }
  }

  function toReportEntry(item: TransactionOutput): PersonReportEntry {
    return {
      id: item.id,
      name: item.name,
      purchaseDate: item.purchaseDate,
      amount: item.allocation?.amount ?? item.amount,
      origin: item.origin,
      type: item.type,
      paymentMethod: item.paymentMethod,
      cardId: item.cardId,
      cardName: item.cardName,
      cardLogo: item.cardLogo,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      categoryIcon: item.categoryIcon,
      currentInstallment: item.currentInstallment,
      installmentCount: item.installmentCount,
      isRecurring: item.isRecurring,
    };
  }

  async function listEntries(person: PersonReportPerson, userId: string, period: string) {
    const transactions = await dependencies.listPersonTransactions(
      userId,
      ListTransactionsQuerySchema.parse({ period, personIds: person.id }),
    );
    return transactions.map(toReportEntry);
  }

  async function buildReport(
    person: PersonReportPerson,
    userId: string,
    period: string,
  ): Promise<PersonReportOutput> {
    const previousPeriod = getPreviousPersonReportPeriod(period);
    const commitmentPeriods = listPersonReportCommitmentPeriods(period);
    const [entries, settlements, previousEntries, commitmentEntries, dueDates] = await Promise.all([
      listEntries(person, userId, period),
      dependencies.listPersonSettlements(person.id, userId, period),
      listEntries(person, userId, previousPeriod),
      Promise.all(commitmentPeriods.map((item) => listEntries(person, userId, item))),
      dependencies.listCardDueDates(userId, period),
    ]);
    const report = buildPersonReport({
      entries,
      settlements: settlements.map(({ id, amount, receivedAt, source }) => ({
        id,
        amount,
        receivedAt,
        source,
      })),
    });
    const previous = buildPersonReport({ entries: previousEntries, settlements: [] });
    const dueDateByCard = new Map(dueDates.map((item) => [item.cardId, item.dueDate]));

    return {
      period,
      person: { id: person.id, name: person.name },
      ...report,
      groups: report.groups.map((group) => ({
        ...group,
        dueDate: group.cardId ? (dueDateByCard.get(group.cardId) ?? null) : null,
      })),
      comparison: comparePersonReportPeriods({
        previousPeriod,
        currentAmount: report.balance.dueAmount,
        previousAmount: previous.balance.dueAmount,
      }),
      commitments: commitmentPeriods
        .map((item, index) =>
          summarizePersonReportCommitment(
            item,
            buildPersonReport({ entries: commitmentEntries[index] ?? [], settlements: [] }),
          ),
        )
        .filter((commitment) => commitment.entryCount > 0),
    };
  }

  async function prepareDelivery(person: PersonReportPerson, userId: string, period: string) {
    const [report, owner] = await Promise.all([
      buildReport(person, userId, period),
      dependencies.findAccountOwner(userId),
    ]);
    const blocker = findPersonReportDeliveryBlocker({
      status: person.status,
      email: person.email,
      entryCount: report.entryCount,
    });
    return { report, owner, blocker };
  }

  /** Sends one delivery and records the outcome; provider failures are returned, not thrown. */
  async function deliver(input: {
    delivery: PersonReportDeliveryRecord;
    report: PersonReportOutput;
    owner: AccountOwner | null;
    message: string | null;
  }) {
    const { delivery, report, owner } = input;
    const attempts = delivery.attempts + 1;
    try {
      const issuedAt = now();
      const [images, spreadsheet] = await Promise.all([
        loadEmailImages(report),
        delivery.includesSpreadsheet ? createPersonReportSpreadsheet(report) : null,
      ]);
      const email = buildPersonReportEmail({
        report,
        senderName: owner?.name ?? "OpenMonetis",
        message: input.message,
        issuedAt,
        partial: isPersonReportPeriodOpen(report.period, getCurrentDateInBrazil(issuedAt)),
        imageSources: inlinePersonReportImageSources(images.map(({ path }) => path)),
      });
      const attachments: EmailAttachment[] = images.map(({ path, image }) => ({
        fileName: path.split("/").at(-1) ?? "image.png",
        contentBase64: image.contentBase64,
        contentType: image.contentType,
        contentId: getPersonReportEmailImageId(path),
      }));
      if (spreadsheet) attachments.push(spreadsheet);
      const { providerMessageId } = await dependencies.emailSender.send({
        to: delivery.recipientEmail,
        replyTo: owner?.email ?? null,
        ...email,
        attachments: attachments.length ? attachments : undefined,
        idempotencyKey: delivery.id,
      });
      const sent = await dependencies.deliveries.updateDeliveryForUser(
        delivery.id,
        delivery.userId,
        { status: "sent", attempts, providerMessageId, errorCode: null, sentAt: now() },
      );
      return { ok: true as const, record: sent ?? delivery };
    } catch (error) {
      logDeliveryFailure(delivery.id, error);
      const failed = await dependencies.deliveries.updateDeliveryForUser(
        delivery.id,
        delivery.userId,
        { status: "failed", attempts, errorCode: "provider_error" },
      );
      return { ok: false as const, record: failed ?? { ...delivery, attempts } };
    }
  }

  function toScheduleState(
    schedule: PersonReportScheduleRecord | null,
  ): PersonReportScheduleStateOutput {
    const current = now();
    const firstDate = firstPersonReportScheduleDate(
      getCurrentDateInBrazil(current),
      getCurrentHourInBrazil(current),
    );
    return {
      emailEnabled: dependencies.emailSender.enabled,
      sendingHour: personReportScheduleHour,
      schedule: schedule
        ? {
            enabled: schedule.enabled,
            frequency: schedule.frequency,
            weekday: schedule.weekday,
            monthDays: schedule.monthDays,
            reportPeriod: schedule.reportPeriod,
            includeSpreadsheet: schedule.includeSpreadsheet,
            updatedAt: schedule.updatedAt.toISOString(),
          }
        : null,
      nextDeliveryDates: schedule?.enabled
        ? listNextPersonReportScheduleDates(schedule, firstDate, nextDeliveryDatesCount)
        : [],
    };
  }

  async function processSchedule(
    schedule: PersonReportScheduleRecord,
    today: string,
  ): Promise<keyof ScheduledDeliveriesSummary | null> {
    if (!isPersonReportScheduleDue(schedule, today)) return null;
    const person = await dependencies.findPerson(schedule.personId, schedule.userId);
    if (person?.role !== "external") return "skipped";

    const existing = await dependencies.deliveries.findScheduledDelivery(
      person.id,
      schedule.userId,
      today,
    );
    if (!shouldAttemptScheduledDelivery(existing, now())) {
      const awaitingRetry =
        existing !== null &&
        existing.status !== "sent" &&
        existing.attempts < maximumScheduledDeliveryAttempts;
      return awaitingRetry ? "retrying" : null;
    }

    // Status and email are checked before the report is built, which costs several queries.
    const personBlocker = findPersonReportDeliveryBlocker({
      status: person.status,
      email: person.email,
      entryCount: 1,
    });
    if (personBlocker) return "skipped";

    const period = resolvePersonReportSchedulePeriod(schedule.reportPeriod, today);
    const { report, owner, blocker } = await prepareDelivery(person, schedule.userId, period);
    if (blocker) return "skipped";

    const delivery =
      existing ??
      (await dependencies.deliveries.insertDelivery({
        userId: schedule.userId,
        personId: person.id,
        period,
        trigger: "scheduled",
        scheduledFor: today,
        recipientEmail: (person.email as string).trim(),
        includesSpreadsheet: schedule.includeSpreadsheet,
      }));
    const result = await deliver({ delivery, report, owner, message: null });
    if (result.ok) return "sent";
    return result.record.attempts >= maximumScheduledDeliveryAttempts ? "failed" : "retrying";
  }

  return {
    async getReport(personId: string, userId: string, period: string) {
      return buildReport(await findExternalPerson(personId, userId), userId, period);
    },

    async listDeliveries(personId: string, userId: string): Promise<PersonReportDeliveriesOutput> {
      const person = await findExternalPerson(personId, userId);
      const deliveries = await dependencies.deliveries.listDeliveriesForPerson(
        person.id,
        userId,
        deliveryHistoryLimit,
      );
      return {
        emailEnabled: dependencies.emailSender.enabled,
        deliveries: deliveries.map(toDeliveryOutput),
      };
    },

    async sendReport(
      personId: string,
      userId: string,
      input: CreatePersonReportDeliveryInput,
    ): Promise<PersonReportDeliveryOutput> {
      const person = await findExternalPerson(personId, userId);
      assertEmailConfigured();
      const { report, owner, blocker } = await prepareDelivery(person, userId, input.period);
      if (blocker) throw badRequest("The report cannot be sent to this person", blocker);

      const delivery = await dependencies.deliveries.insertDelivery({
        userId,
        personId: person.id,
        period: input.period,
        trigger: "manual",
        recipientEmail: (person.email as string).trim(),
        includesSpreadsheet: input.includeSpreadsheet ?? false,
      });
      const result = await deliver({
        delivery,
        report,
        owner,
        message: input.message?.trim() || null,
      });
      if (!result.ok) {
        throw new ApiError("The email could not be delivered", "email_delivery_failed", 503);
      }
      return toDeliveryOutput(result.record);
    },

    /**
     * The same statement sent by email, as a printable page. Images point to the web app's public
     * files, so the browser loads them without attachments.
     */
    async getReportDocument(
      personId: string,
      userId: string,
      period: string,
    ): Promise<PersonReportDocumentOutput> {
      const person = await findExternalPerson(personId, userId);
      const [report, owner] = await Promise.all([
        buildReport(person, userId, period),
        dependencies.findAccountOwner(userId),
      ]);
      const issuedAt = now();
      const title = `Extrato de ${person.name} - ${formatReportPeriod(period)}`;
      const { html } = buildPersonReportEmail({
        report,
        senderName: owner?.name ?? "OpenMonetis",
        issuedAt,
        partial: isPersonReportPeriodOpen(period, getCurrentDateInBrazil(issuedAt)),
        imageSources: new Map(
          getPersonReportEmailImagePaths(report)
            .filter(isEmailImagePath)
            .map((path) => [path, path]),
        ),
        printTitle: title,
      });
      return { title, html };
    },

    async getSchedule(personId: string, userId: string) {
      const person = await findExternalPerson(personId, userId);
      return toScheduleState(await dependencies.schedules.findScheduleForPerson(person.id, userId));
    },

    async updateSchedule(personId: string, userId: string, input: UpdatePersonReportScheduleInput) {
      const person = await findExternalPerson(personId, userId);
      if (input.enabled) {
        assertEmailConfigured();
        const blocker = findPersonReportDeliveryBlocker({
          status: person.status,
          email: person.email,
          entryCount: 1,
        });
        if (blocker) {
          throw badRequest("Scheduled reports need an active person with an email", blocker);
        }
      }
      const schedule = await dependencies.schedules.upsertSchedule({
        userId,
        personId: person.id,
        enabled: input.enabled,
        ...normalizePersonReportScheduleRule(input),
        reportPeriod: input.reportPeriod,
        includeSpreadsheet: input.includeSpreadsheet,
      });
      return toScheduleState(schedule);
    },

    /**
     * Sends today's scheduled reports from the sending hour on, at most once per person and date.
     * Safe to call repeatedly and from several instances: a finished day is skipped, sent
     * deliveries are never repeated and failed ones are retried after a delay. Returns null when
     * there was nothing to run.
     */
    async runScheduledDeliveries(): Promise<ScheduledDeliveriesSummary | null> {
      const current = now();
      if (!dependencies.emailSender.enabled) return null;
      if (getCurrentHourInBrazil(current) < personReportScheduleHour) return null;
      const today = getCurrentDateInBrazil(current);
      const lastCompleted = await dependencies.schedules.findLastCompletedRunDate();
      if (lastCompleted && lastCompleted >= today) return null;

      const summary: ScheduledDeliveriesSummary = { sent: 0, failed: 0, skipped: 0, retrying: 0 };
      for (const schedule of await dependencies.schedules.listEnabledSchedules()) {
        try {
          const outcome = await processSchedule(schedule, today);
          if (outcome) summary[outcome] += 1;
        } catch (error) {
          // An unexpected error keeps the day open, so the next run tries this schedule again.
          console.error("person_report_schedule_failed", error);
          summary.retrying += 1;
        }
      }
      if (summary.retrying === 0) await dependencies.schedules.markRunCompleted(today, now());
      return summary;
    },
  };
}

export type PersonReportsService = ReturnType<typeof createPersonReportsService>;
