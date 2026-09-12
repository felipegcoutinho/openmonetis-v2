import {
  dateOnlyToSafeInstant,
  differenceInCalendarDaysFromTodayInBrazil,
  formatDateInBrazil,
} from "@openmonetis/shared/date-time";
import type { NotificationOutput } from "@openmonetis/validators/notifications";

export function getNotificationCopy(notification: NotificationOutput) {
  if (notification.kind === "bill") {
    return {
      title: notification.name,
      context: notification.status === "overdue" ? "Boleto vencido" : "Boleto a vencer",
      detail: dueDateLabel(notification.dueDate),
    };
  }

  if (notification.kind === "invoice") {
    return {
      title: notification.cardName,
      context: notification.status === "overdue" ? "Fatura vencida" : "Fatura a vencer",
      detail: dueDateLabel(notification.dueDate),
    };
  }

  if (notification.kind === "budget") {
    const percentage = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(
      notification.usagePercentage,
    );
    return {
      title: notification.categoryName,
      context:
        notification.status === "exceeded"
          ? "Orçamento excedido"
          : notification.status === "reached"
            ? "Limite do orçamento atingido"
            : "Orçamento perto do limite",
      detail: `${percentage}% comprometido`,
    };
  }

  if (notification.kind === "externalExpenses") {
    const title =
      notification.pendingCount === 1
        ? "1 lançamento compartilhado"
        : `${notification.pendingCount} lançamentos compartilhados`;
    const context =
      notification.counterpartCount === 1
        ? `${notification.latestCounterpartName} enviou ${
            notification.pendingCount === 1
              ? "este lançamento"
              : `${notification.pendingCount} lançamentos`
          }`
        : `${notification.latestCounterpartName} e mais ${notification.counterpartCount - 1} ${
            notification.counterpartCount === 2 ? "pessoa enviaram" : "pessoas enviaram"
          } lançamentos`;
    return {
      title,
      context,
      detail: "Revise e importe os lançamentos pendentes",
    };
  }

  if (notification.kind === "task") {
    return {
      title: notification.title,
      context: notification.status === "overdue" ? "Tarefa atrasada" : "Tarefa a vencer",
      detail: dueDateLabel(notification.dueDate),
    };
  }

  return {
    title: "Caixa de entrada",
    context: "Capturas para revisar",
    detail:
      notification.pendingCount === 1
        ? "1 captura aguarda confirmação"
        : `${notification.pendingCount} capturas aguardam confirmação`,
  };
}

export function getNotificationAmount(notification: NotificationOutput) {
  if (notification.kind === "bill") return notification.amount;
  if (notification.kind === "invoice") return notification.remainingAmount;
  if (notification.kind === "budget") return notification.committedAmount;
  if (notification.kind === "externalExpenses") {
    return notification.totalAmount;
  }
  return null;
}

export function getNotificationTarget(notification: NotificationOutput) {
  if (notification.kind === "bill") {
    return {
      to: "/transactions",
      search: {
        period: notification.period,
        paymentMethod: "boleto",
        settlement: "unpaid",
      },
    };
  }
  if (notification.kind === "invoice") {
    return { to: `/cards/${notification.cardId}`, search: { period: notification.period } };
  }
  if (notification.kind === "budget") {
    return { to: "/budgets", search: { period: notification.period } };
  }
  if (notification.kind === "externalExpenses") {
    return {
      to: "/people/admin",
      search: { period: notification.period, view: "external" },
    };
  }
  if (notification.kind === "task") {
    return { to: "/notes", search: {} };
  }
  return { to: "/inbox", search: { status: "pending" } };
}

function dueDateLabel(dueDate: string) {
  const days = differenceInCalendarDaysFromTodayInBrazil(dueDate);
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  if (days > 1) return `Vence em ${days} dias`;
  if (days === -1) return "Venceu ontem";
  if (days > -30) return `Venceu há ${Math.abs(days)} dias`;
  return `Venceu em ${formatDateInBrazil(dateOnlyToSafeInstant(dueDate), {
    day: "2-digit",
    month: "short",
  })}`;
}
