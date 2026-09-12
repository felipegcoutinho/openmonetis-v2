import {
  buildNotifications,
  getNotificationDueThroughDate,
  type NotificationState,
  notificationLookaheadMonths,
  notificationLookbackMonths,
  updateNotificationState,
} from "@openmonetis/domain/notifications";
import { addMonthsToPeriod } from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { DashboardBillsOutput } from "@openmonetis/validators/bills";
import type { BudgetOverviewOutput } from "@openmonetis/validators/budgets";
import type { ExternalExpenseSummaryOutput } from "@openmonetis/validators/external-expenses";
import type { InboxSnapshotOutput } from "@openmonetis/validators/inbox";
import type { DashboardInvoicesOutput } from "@openmonetis/validators/invoices";
import type {
  NotificationsOutput,
  UpdateNotificationStateInput,
} from "@openmonetis/validators/notifications";
import type { UserPreferencesOutput } from "@openmonetis/validators/preferences";
import { badRequest, conflict, notFound } from "../utils/errors";

export type NotificationsRepository = {
  listForKeys(userId: string, notificationKeys: string[]): Promise<NotificationState[]>;
  save(userId: string, state: NotificationState): Promise<void>;
};

type NotificationSources = {
  bills: {
    get(period: string, userId: string): Promise<DashboardBillsOutput>;
  };
  budgets: {
    list(userId: string, query: { period: string }): Promise<BudgetOverviewOutput>;
  };
  inbox: {
    snapshot(userId: string, limit: number): Promise<InboxSnapshotOutput>;
  };
  invoices: {
    get(period: string, userId: string): Promise<DashboardInvoicesOutput>;
  };
  externalExpenses: {
    summary(userId: string): Promise<ExternalExpenseSummaryOutput>;
  };
  notes: {
    listTaskReminders(
      userId: string,
      dueBy: string,
    ): Promise<Array<{ id: string; title: string; dueDate: string; updatedAt: string }>>;
  };
};

type NotificationPreferencesReader = {
  get(userId: string): Promise<Pick<UserPreferencesOutput, "notificationDueSoonDays">>;
};

export function createNotificationsService(
  repository: NotificationsRepository,
  sources: NotificationSources,
  preferences: NotificationPreferencesReader,
  options: {
    now?: () => Date;
    today?: () => string;
    currentPeriod?: () => string;
  } = {},
) {
  const now = options.now ?? (() => new Date());
  const today = options.today ?? getCurrentDateInBrazil;
  const currentPeriod = options.currentPeriod ?? getCurrentPeriodInBrazil;

  async function list(userId: string): Promise<NotificationsOutput> {
    const period = currentPeriod();
    const businessDate = today();
    const sourcePeriods = Array.from(
      { length: notificationLookbackMonths + notificationLookaheadMonths + 1 },
      (_item, index) => addMonthsToPeriod(period, index - notificationLookbackMonths),
    );
    const userPreferences = await preferences.get(userId);
    const [
      billSnapshots,
      invoiceSnapshots,
      budgetSnapshot,
      inboxSnapshot,
      externalExpenseSummary,
      tasks,
    ] = await Promise.all([
      Promise.all(sourcePeriods.map((sourcePeriod) => sources.bills.get(sourcePeriod, userId))),
      Promise.all(sourcePeriods.map((sourcePeriod) => sources.invoices.get(sourcePeriod, userId))),
      sources.budgets.list(userId, { period }),
      sources.inbox.snapshot(userId, 1),
      sources.externalExpenses.summary(userId),
      sources.notes.listTaskReminders(
        userId,
        getNotificationDueThroughDate(businessDate, userPreferences.notificationDueSoonDays),
      ),
    ]);
    const notificationSources = {
      bills: billSnapshots.flatMap((snapshot) => snapshot.items),
      invoices: invoiceSnapshots.flatMap((snapshot) => snapshot.items),
      budgets: budgetSnapshot.items,
      inbox: {
        pendingCount: inboxSnapshot.pendingCount,
        latestItemAt: inboxSnapshot.recentItems[0]?.notificationTimestamp ?? null,
      },
      externalExpenses: externalExpenseSummary,
      tasks,
    };
    const unresolvedItems = buildNotifications({
      today: businessDate,
      dueSoonDays: userPreferences.notificationDueSoonDays,
      sources: notificationSources,
      states: [],
    });
    const states = await repository.listForKeys(
      userId,
      unresolvedItems.map((item) => item.notificationKey),
    );
    const items = buildNotifications({
      today: businessDate,
      dueSoonDays: userPreferences.notificationDueSoonDays,
      sources: notificationSources,
      states,
    });
    const activeItems = items.filter((item) => !item.isArchived);

    return {
      items,
      unreadCount: activeItems.filter((item) => !item.isRead).length,
      activeCount: activeItems.length,
      archivedCount: items.length - activeItems.length,
      generatedAt: now().toISOString(),
    };
  }

  return {
    list,

    async update(notificationKey: string, input: UpdateNotificationStateInput, userId: string) {
      const snapshot = await list(userId);
      const notification = snapshot.items.find((item) => item.notificationKey === notificationKey);
      if (!notification) throw notFound("Notification not found", "notification_not_found");
      if (notification.fingerprint !== input.fingerprint) {
        throw conflict("Notification changed. Reload and try again", "notification_state_conflict");
      }
      if (input.isArchived && !notification.canArchive) {
        throw badRequest(
          "Action-required notifications cannot be archived",
          "notification_archive_not_allowed",
        );
      }

      const state = updateNotificationState(
        {
          notificationKey,
          fingerprint: notification.fingerprint,
          readAt: notification.readAt,
          archivedAt: notification.archivedAt,
        },
        { notificationKey, ...input },
        now().toISOString(),
      );
      await repository.save(userId, state);
      return {
        notificationKey,
        isRead: state.readAt !== null,
        isArchived: state.archivedAt !== null,
      };
    },
  };
}

export type NotificationsService = ReturnType<typeof createNotificationsService>;
