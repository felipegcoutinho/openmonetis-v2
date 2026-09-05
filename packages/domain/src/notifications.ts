export const notificationLookbackMonths = 2;
export const notificationLookaheadMonths = 1;

export const notificationSeverities = ["critical", "warning", "info"] as const;
export type NotificationSeverity = (typeof notificationSeverities)[number];

export type NotificationState = {
  notificationKey: string;
  fingerprint: string;
  readAt: string | null;
  archivedAt: string | null;
};

type NotificationBase = {
  notificationKey: string;
  fingerprint: string;
  severity: NotificationSeverity;
  canArchive: boolean;
  isRead: boolean;
  isArchived: boolean;
  readAt: string | null;
  archivedAt: string | null;
};

export type BillNotification = NotificationBase & {
  kind: "bill";
  billId: string;
  name: string;
  amount: number;
  dueDate: string;
  period: string;
  status: "overdue" | "dueSoon";
};

export type InvoiceNotification = NotificationBase & {
  kind: "invoice";
  cardId: string;
  cardName: string;
  cardLogo: string | null;
  remainingAmount: number;
  dueDate: string;
  period: string;
  status: "overdue" | "dueSoon";
};

export type BudgetNotification = NotificationBase & {
  kind: "budget";
  budgetId: string;
  categoryName: string;
  categoryIcon: string | null;
  budgetAmount: number;
  committedAmount: number;
  usagePercentage: number;
  period: string;
  status: "warning" | "reached" | "exceeded";
};

export type InboxNotification = NotificationBase & {
  kind: "inbox";
  pendingCount: number;
  latestItemAt: string;
};

export type ExternalExpensesNotification = NotificationBase & {
  kind: "externalExpenses";
  pendingCount: number;
  totalAmount: number;
  counterpartCount: number;
  latestCounterpartName: string;
  period: string;
  latestUpdatedAt: string;
  action: "import";
};

export type Notification =
  | BillNotification
  | InvoiceNotification
  | BudgetNotification
  | InboxNotification
  | ExternalExpensesNotification;

export type NotificationSources = {
  bills: Array<{
    id: string;
    name: string;
    amount: number;
    dueDate: string;
    period: string;
    isSettled: boolean;
  }>;
  invoices: Array<{
    cardId: string;
    cardName: string;
    logo: string | null;
    remainingAmount: number;
    dueDate: string;
    period: string;
    status: "open" | "closed" | "overdue" | "paid";
  }>;
  budgets: Array<{
    id: string;
    categoryName: string;
    categoryIcon: string | null;
    amount: number;
    committedAmount: number;
    usagePercentage: number;
    period: string;
    status: "onTrack" | "warning" | "reached" | "exceeded";
  }>;
  inbox: {
    pendingCount: number;
    latestItemAt: string | null;
  };
  externalExpenses: {
    pendingCount: number;
    totalAmount: number;
    counterpartCount: number;
    latestCounterpartName: string | null;
    latestUpdatedAt: string | null;
    latestPeriod: string | null;
  };
};

export function buildNotifications(input: {
  today: string;
  dueSoonDays: number;
  sources: NotificationSources;
  states: NotificationState[];
}): Notification[] {
  const statesByKey = new Map(input.states.map((state) => [state.notificationKey, state]));
  const notifications: Notification[] = [];

  for (const bill of uniqueBy(input.sources.bills, (item) => item.id)) {
    if (bill.isSettled) continue;
    const status = dueStatus(bill.dueDate, input.today, input.dueSoonDays);
    if (!status) continue;

    notifications.push(
      withState(
        {
          kind: "bill" as const,
          billId: bill.id,
          name: bill.name,
          amount: bill.amount,
          dueDate: bill.dueDate,
          period: bill.period,
          status,
          severity: status === "overdue" ? "critical" : "warning",
          canArchive: true,
          notificationKey: `bill:${bill.id}`,
          fingerprint: [status, bill.dueDate].join(":"),
        },
        statesByKey,
      ),
    );
  }

  for (const invoice of uniqueBy(
    input.sources.invoices,
    (item) => `${item.cardId}:${item.period}`,
  )) {
    if (invoice.status === "paid" || invoice.remainingAmount <= 0) continue;
    const status = dueStatus(invoice.dueDate, input.today, input.dueSoonDays);
    if (!status) continue;

    notifications.push(
      withState(
        {
          kind: "invoice" as const,
          cardId: invoice.cardId,
          cardName: invoice.cardName,
          cardLogo: invoice.logo,
          remainingAmount: invoice.remainingAmount,
          dueDate: invoice.dueDate,
          period: invoice.period,
          status,
          severity: status === "overdue" ? "critical" : "warning",
          canArchive: true,
          notificationKey: `invoice:${invoice.cardId}:${invoice.period}`,
          fingerprint: [status, invoice.dueDate].join(":"),
        },
        statesByKey,
      ),
    );
  }

  for (const budget of input.sources.budgets) {
    if (budget.status === "onTrack") continue;

    notifications.push(
      withState(
        {
          kind: "budget" as const,
          budgetId: budget.id,
          categoryName: budget.categoryName,
          categoryIcon: budget.categoryIcon,
          budgetAmount: budget.amount,
          committedAmount: budget.committedAmount,
          usagePercentage: budget.usagePercentage,
          period: budget.period,
          status: budget.status,
          severity: budget.status === "warning" ? "warning" : "critical",
          canArchive: true,
          notificationKey: `budget:${budget.id}`,
          fingerprint: budget.status,
        },
        statesByKey,
      ),
    );
  }

  if (input.sources.inbox.pendingCount > 0 && input.sources.inbox.latestItemAt) {
    notifications.push(
      withState(
        {
          kind: "inbox" as const,
          pendingCount: input.sources.inbox.pendingCount,
          latestItemAt: input.sources.inbox.latestItemAt,
          severity: "info",
          canArchive: true,
          notificationKey: "inbox:pending",
          fingerprint: input.sources.inbox.latestItemAt,
        },
        statesByKey,
      ),
    );
  }

  const externalExpenses = input.sources.externalExpenses;
  if (
    externalExpenses.pendingCount > 0 &&
    externalExpenses.counterpartCount > 0 &&
    externalExpenses.latestCounterpartName &&
    externalExpenses.latestUpdatedAt &&
    externalExpenses.latestPeriod
  ) {
    notifications.push(
      withState(
        {
          kind: "externalExpenses" as const,
          pendingCount: externalExpenses.pendingCount,
          totalAmount: externalExpenses.totalAmount,
          counterpartCount: externalExpenses.counterpartCount,
          latestCounterpartName: externalExpenses.latestCounterpartName,
          period: externalExpenses.latestPeriod,
          latestUpdatedAt: externalExpenses.latestUpdatedAt,
          action: "import" as const,
          severity: "warning",
          canArchive: false,
          notificationKey: "externalExpenses:pending",
          fingerprint: externalExpenses.latestUpdatedAt,
        },
        statesByKey,
      ),
    );
  }

  return notifications.sort(compareNotifications);
}

export function updateNotificationState(
  current: NotificationState | null,
  input: { notificationKey: string; fingerprint: string; isRead?: boolean; isArchived?: boolean },
  now: string,
): NotificationState {
  const matchesCurrentFingerprint = current?.fingerprint === input.fingerprint;
  const wasRead = matchesCurrentFingerprint && current?.readAt !== null;
  const wasArchived = matchesCurrentFingerprint && current?.archivedAt !== null;
  const isArchived = input.isArchived ?? wasArchived;
  const isRead = isArchived || (input.isRead ?? wasRead);

  return {
    notificationKey: input.notificationKey,
    fingerprint: input.fingerprint,
    readAt: isRead ? (wasRead && current?.readAt ? current.readAt : now) : null,
    archivedAt: isArchived ? (wasArchived && current?.archivedAt ? current.archivedAt : now) : null,
  };
}

function dueStatus(
  dueDate: string,
  today: string,
  dueSoonDays: number,
): "overdue" | "dueSoon" | null {
  const days = differenceInCalendarDays(dueDate, today);
  if (days < 0) return "overdue";
  if (days <= dueSoonDays) return "dueSoon";
  return null;
}

function differenceInCalendarDays(date: string, reference: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00.000Z`) - Date.parse(`${reference}T00:00:00.000Z`)) / 86_400_000,
  );
}

function withState<
  T extends Omit<NotificationBase, "isRead" | "isArchived" | "readAt" | "archivedAt">,
>(
  notification: T,
  statesByKey: Map<string, NotificationState>,
): T & Pick<NotificationBase, "isRead" | "isArchived" | "readAt" | "archivedAt"> {
  const state = statesByKey.get(notification.notificationKey);
  const current = state?.fingerprint === notification.fingerprint ? state : null;

  return {
    ...notification,
    isRead: Boolean(current?.readAt),
    isArchived: Boolean(current?.archivedAt),
    readAt: current?.readAt ?? null,
    archivedAt: current?.archivedAt ?? null,
  };
}

function compareNotifications(left: Notification, right: Notification) {
  const severity = { critical: 0, warning: 1, info: 2 } as const;
  const severityDifference = severity[left.severity] - severity[right.severity];
  if (severityDifference !== 0) return severityDifference;

  const leftDate = notificationDate(left);
  const rightDate = notificationDate(right);
  return (
    leftDate.localeCompare(rightDate) || left.notificationKey.localeCompare(right.notificationKey)
  );
}

function notificationDate(notification: Notification) {
  if (notification.kind === "bill" || notification.kind === "invoice") return notification.dueDate;
  if (notification.kind === "budget") return `${notification.period}-01`;
  if (notification.kind === "inbox") return notification.latestItemAt;
  return notification.latestUpdatedAt;
}

function uniqueBy<T>(items: T[], key: (item: T) => string) {
  const unique = new Map<string, T>();
  for (const item of items) unique.set(key(item), item);
  return [...unique.values()];
}
