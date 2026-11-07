import { formatDateInBrazil, periodToSafeInstant } from "@openmonetis/shared/date-time";
import type {
  PersonReportGroupOutput,
  PersonReportLineOutput,
  PersonReportOutput,
} from "@openmonetis/validators/person-reports";
import { paymentMethodLabels } from "./transactions-export";

const currencyFormatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatReportCurrency(amount: number) {
  return currencyFormatter.format(amount);
}

/** "Outubro de 2026". */
export function formatReportPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), { month: "long", year: "numeric" });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

/** "05/10". */
export function formatReportDate(value: string) {
  const [, month, day] = value.split("-");
  return `${day}/${month}`;
}

export function getReportGroupLabel(
  group: Pick<PersonReportGroupOutput, "cardName" | "paymentMethod">,
) {
  if (group.cardName) return group.cardName;
  return group.paymentMethod ? paymentMethodLabels[group.paymentMethod] : "Outros";
}

export function getReportLineTags(line: PersonReportLineOutput) {
  const tags: string[] = [];
  if (line.kind === "refund") tags.push("Estorno");
  if (line.currentInstallment && line.installmentCount) {
    tags.push(`${line.currentInstallment}/${line.installmentCount}`);
  }
  if (line.isRecurring) tags.push("Recorrente");
  return tags;
}

/** Refunds reduce what the person owes, so they are shown as negative amounts. */
export function getReportLineAmount(line: Pick<PersonReportLineOutput, "amount" | "kind">) {
  return line.kind === "refund" ? -line.amount : line.amount;
}

type ReportPaymentMethod = NonNullable<PersonReportGroupOutput["paymentMethod"]>;

const paymentMethodLogoPaths: Partial<Record<ReportPaymentMethod, string>> = {
  pix: "/logos/pix.png",
  cash: "/logos/dinheiro.png",
};

/** Bundled logo of the group's card or payment method; external logo URLs are left out. */
export function getReportGroupLogoPath(
  group: Pick<PersonReportGroupOutput, "cardId" | "cardLogo" | "paymentMethod">,
) {
  if (group.cardId) return group.cardLogo?.startsWith("/logos/") ? group.cardLogo : null;
  return group.paymentMethod ? (paymentMethodLogoPaths[group.paymentMethod] ?? null) : null;
}

/** "outubro". */
export function formatReportMonth(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), { month: "long" });
}

/** "+R$ 16,00 (25% a mais)", "-R$ 8,00 (10% a menos)", "Igual" or "Sem despesas antes". */
export function describeReportComparison(comparison: PersonReportOutput["comparison"]) {
  const { differenceAmount, changePercentage, previousAmount } = comparison;
  if (previousAmount === 0) return "Sem despesas no mês anterior";
  if (differenceAmount === 0) return "Igual ao mês anterior";
  const percentage = Math.abs(changePercentage ?? 0).toLocaleString("pt-BR");
  const sign = differenceAmount > 0 ? "+" : "-";
  const direction = differenceAmount > 0 ? "a mais" : "a menos";
  return `${sign}${formatReportCurrency(Math.abs(differenceAmount))} (${percentage}% ${direction})`;
}

/** "3 lançamentos · 1 parcela · 2 recorrentes". */
export function describeReportCommitment(commitment: PersonReportOutput["commitments"][number]) {
  const parts = [
    commitment.entryCount === 1 ? "1 lançamento" : `${commitment.entryCount} lançamentos`,
  ];
  if (commitment.installmentCount) {
    parts.push(
      commitment.installmentCount === 1 ? "1 parcela" : `${commitment.installmentCount} parcelas`,
    );
  }
  if (commitment.recurringCount) {
    parts.push(
      commitment.recurringCount === 1 ? "1 recorrente" : `${commitment.recurringCount} recorrentes`,
    );
  }
  return parts.join(" · ");
}
