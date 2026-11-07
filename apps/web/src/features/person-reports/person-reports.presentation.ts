import {
  findPersonReportDeliveryBlocker,
  isPersonReportPeriodOpen,
  type PersonReportScheduleFrequency,
  type PersonReportSchedulePeriod,
  type PersonReportScheduleRule,
} from "@openmonetis/domain/person-reports";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { PersonOutput } from "@openmonetis/validators/people";
import type {
  PersonReportCommitmentOutput,
  PersonReportComparisonOutput,
  PersonReportDeliveryOutput,
  PersonReportGroupOutput,
  PersonReportLineOutput,
} from "@openmonetis/validators/person-reports";
import { personPaymentMethodLabels } from "../people/people.presentation";

export function getPersonReportGroupLabel(
  group: Pick<PersonReportGroupOutput, "cardName" | "paymentMethod">,
) {
  if (group.cardName) return group.cardName;
  return group.paymentMethod ? personPaymentMethodLabels[group.paymentMethod] : "Outros";
}

export function formatPersonReportLineCount(count: number) {
  return `${count} ${count === 1 ? "lançamento" : "lançamentos"}`;
}

export function getPersonReportLineTags(line: PersonReportLineOutput) {
  const tags: string[] = [];
  if (line.kind === "refund") tags.push("Estorno");
  if (line.currentInstallment && line.installmentCount) {
    tags.push(`${line.currentInstallment}/${line.installmentCount}`);
  }
  if (line.isRecurring) tags.push("Recorrente");
  return tags;
}

/** Refunds reduce what the person owes, so they are shown as negative amounts. */
export function getPersonReportLineAmount(line: Pick<PersonReportLineOutput, "amount" | "kind">) {
  return line.kind === "refund" ? -line.amount : line.amount;
}

export function formatPersonReportDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export const personReportDeliveryStatusLabels: Record<
  PersonReportDeliveryOutput["status"],
  string
> = {
  pending: "Enviando",
  sent: "Enviado",
  failed: "Não entregue",
};

/** Why the report cannot be emailed right now, or null when it can. */
export function getPersonReportEmailUnavailableReason(input: {
  emailEnabled: boolean;
  person: Pick<PersonOutput, "email" | "name" | "status">;
  entryCount: number;
}) {
  if (!input.emailEnabled) return "O envio por e-mail não está configurado nesta instalação.";
  const blocker = findPersonReportDeliveryBlocker({
    status: input.person.status,
    email: input.person.email,
    entryCount: input.entryCount,
  });
  if (blocker === "person_inactive") return "Reative a pessoa para enviar o extrato.";
  if (blocker === "person_email_missing") {
    return `Cadastre um e-mail para ${input.person.name} para enviar o extrato.`;
  }
  if (blocker === "person_report_empty") return "Não há despesas neste mês para enviar.";
  return null;
}

const deliveryErrorMessages: Record<string, string> = {
  email_not_configured: "O envio por e-mail não está configurado nesta instalação.",
  email_delivery_failed: "O e-mail não foi entregue. Tente novamente em instantes.",
  person_email_missing: "Cadastre um e-mail para esta pessoa antes de enviar.",
  person_inactive: "Reative a pessoa para enviar o extrato.",
  person_report_empty: "Não há despesas neste mês para enviar.",
};

export function getPersonReportDeliveryErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  const status =
    error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
  if (status === 429) return "Muitos envios em pouco tempo. Aguarde alguns minutos.";
  return (code && deliveryErrorMessages[code]) ?? "Não foi possível enviar o extrato.";
}

export function formatPersonReportDeliveryDate(value: string) {
  const date = new Date(value);
  const day = date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  return `${day} às ${time}`;
}

export const personReportDeliveryTriggerLabels: Record<
  PersonReportDeliveryOutput["trigger"],
  string
> = {
  manual: "Manual",
  scheduled: "Automático",
};

/** A report of the current month can still change until the month closes. */
export function isPersonReportPartial(period: string, now = new Date()) {
  return isPersonReportPeriodOpen(period, getCurrentDateInBrazil(now));
}

export const personReportScheduleFrequencyLabels: Record<PersonReportScheduleFrequency, string> = {
  weekly: "Semanal",
  semimonthly: "Quinzenal",
  monthly: "Mensal",
  monthDays: "Dias específicos",
};

export const personReportScheduleFrequencyDescriptions: Record<
  PersonReportScheduleFrequency,
  string
> = {
  weekly: "Uma vez por semana",
  semimonthly: "Duas vezes por mês",
  monthly: "Uma vez por mês",
  monthDays: "Nos dias que você escolher",
};

export const personReportWeekdayLabels = [
  "Domingo",
  "Segunda-feira",
  "Terça-feira",
  "Quarta-feira",
  "Quinta-feira",
  "Sexta-feira",
  "Sábado",
] as const;

export const personReportWeekdayShortLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export const personReportSchedulePeriodLabels: Record<PersonReportSchedulePeriod, string> = {
  previous: "Mês anterior",
  current: "Mês atual (parcial)",
};

export const personReportSchedulePeriodDescriptions: Record<PersonReportSchedulePeriod, string> = {
  previous: "O extrato completo do mês que já fechou.",
  current: "Os lançamentos do mês em andamento, registrados até o dia do envio.",
};

function joinDays(days: number[]) {
  if (days.length <= 1) return days.join("");
  return `${days.slice(0, -1).join(", ")} e ${days.at(-1)}`;
}

/** "Toda segunda-feira", "Todo dia 1", "Dias 1 e 16". */
export function describePersonReportSchedule(rule: PersonReportScheduleRule) {
  if (rule.frequency === "weekly") {
    const weekday = personReportWeekdayLabels[rule.weekday ?? 0] ?? "";
    const article = rule.weekday === 0 || rule.weekday === 6 ? "Todo" : "Toda";
    return `${article} ${weekday.toLocaleLowerCase("pt-BR")}`;
  }
  if (rule.monthDays.length === 1) return `Todo dia ${rule.monthDays[0]}`;
  return `Dias ${joinDays(rule.monthDays)}`;
}

/** "seg., 16/11" for a YYYY-MM-DD date. */
export function formatPersonReportScheduleDate(value: string) {
  return new Date(`${value}T12:00:00.000Z`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Why automatic emails cannot be turned on for the person, or null when they can. */
export function getPersonReportScheduleUnavailableReason(input: {
  emailEnabled: boolean;
  person: Pick<PersonOutput, "email" | "name" | "status">;
}) {
  return getPersonReportEmailUnavailableReason({ ...input, entryCount: 1 });
}

const scheduleErrorMessages: Record<string, string> = {
  email_not_configured: "O envio por e-mail não está configurado nesta instalação.",
  person_email_missing: "Cadastre um e-mail para esta pessoa antes de ativar o envio.",
  person_inactive: "Reative a pessoa para ativar o envio automático.",
};

export function getPersonReportScheduleErrorMessage(error: unknown) {
  const code =
    error && typeof error === "object" && "code" in error ? String(error.code) : undefined;
  const status =
    error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
  if (status === 429) return "Muitas alterações em pouco tempo. Aguarde alguns minutos.";
  return (code && scheduleErrorMessages[code]) ?? "Não foi possível salvar o envio automático.";
}

/** "há 5 min", "hoje às 14:54", "ontem às 09:10" or "07/11 às 14:54". */
export function formatPersonReportDeliveryMoment(value: string, now = new Date()) {
  const date = new Date(value);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes >= 0 && minutes < 1) return "agora";
  if (minutes >= 0 && minutes < 60) return `há ${minutes} min`;
  const time = date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
  const today = getCurrentDateInBrazil(now);
  const day = getCurrentDateInBrazil(date);
  if (day === today) return `hoje às ${time}`;
  if (day === getCurrentDateInBrazil(new Date(now.getTime() - 86_400_000))) {
    return `ontem às ${time}`;
  }
  return formatPersonReportDeliveryDate(value);
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function formatMonth(period: string) {
  return new Date(`${period}-15T12:00:00.000Z`).toLocaleDateString("pt-BR", {
    month: "long",
    timeZone: "UTC",
  });
}

/** How the month compares with the previous one, from the person's total before settlements. */
export function describePersonReportComparison(comparison: PersonReportComparisonOutput) {
  const month = formatMonth(comparison.previousPeriod);
  const { differenceAmount, changePercentage, previousAmount } = comparison;
  if (previousAmount === 0) return { trend: "none" as const, text: `Sem despesas em ${month}` };
  if (differenceAmount === 0) return { trend: "equal" as const, text: `Igual a ${month}` };
  const percentage = Math.abs(changePercentage ?? 0).toLocaleString("pt-BR");
  const amount = currencyFormatter.format(Math.abs(differenceAmount));
  return differenceAmount > 0
    ? { trend: "up" as const, text: `${percentage}% a mais que ${month} (+${amount})` }
    : { trend: "down" as const, text: `${percentage}% a menos que ${month} (-${amount})` };
}

/** "3 lançamentos · 1 parcela · 2 recorrentes". */
export function describePersonReportCommitment(commitment: PersonReportCommitmentOutput) {
  const parts = [formatPersonReportLineCount(commitment.entryCount)];
  if (commitment.installmentCount) {
    parts.push(
      `${commitment.installmentCount} ${commitment.installmentCount === 1 ? "parcela" : "parcelas"}`,
    );
  }
  if (commitment.recurringCount) {
    parts.push(
      `${commitment.recurringCount} ${commitment.recurringCount === 1 ? "recorrente" : "recorrentes"}`,
    );
  }
  return parts.join(" · ");
}
