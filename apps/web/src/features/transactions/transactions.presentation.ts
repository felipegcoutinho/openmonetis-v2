import type { BulkTransactionTarget } from "@openmonetis/domain/transactions";
import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type {
  InstallmentOptionOutput,
  TransactionInput,
  TransactionOutput,
} from "@openmonetis/validators/transactions";
import {
  Banknote,
  Barcode,
  CalendarClock,
  Check,
  CreditCard,
  Landmark,
  type LucideIcon,
  QrCode,
  RefreshCw,
} from "lucide-react";
import { formatCurrency } from "../../lib/money-presentation";

export { formatCurrency as formatTransactionFilterAmount } from "../../lib/money-presentation";

export function downloadTransactionExport(file: {
  contentBase64: string;
  contentType: string;
  fileName: string;
}) {
  const content = Uint8Array.from(atob(file.contentBase64), (character) => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([content], { type: file.contentType }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

type TransactionType = TransactionInput["type"];
type TransactionCondition = NonNullable<TransactionInput["condition"]>;
type PaymentMethod = TransactionInput["paymentMethod"];
type RecurrenceFrequency = NonNullable<TransactionInput["recurrenceFrequency"]>;
type TransactionOrigin = TransactionOutput["origin"];

export const transactionConditionIcons: Record<TransactionCondition, LucideIcon> = {
  single: Check,
  installment: CalendarClock,
  recurring: RefreshCw,
};

export const paymentMethodIcons: Record<NonNullable<PaymentMethod>, LucideIcon> = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: Landmark,
  bank_transfer: Landmark,
};

export type TransactionsSearch = {
  edit?: string;
  period?: string;
  q?: string;
  type?: TransactionType;
  condition?: TransactionCondition;
  paymentMethod?: PaymentMethod;
  settlement?: "paid" | "unpaid" | "invoice";
  sort?: "recent" | "oldest" | "dueDate" | "amount";
  people?: string;
  categories?: string;
  tags?: string;
  withoutTags?: true;
  accounts?: string;
  cards?: string;
  minAmount?: number;
  maxAmount?: number;
  dateStart?: string;
  dateEnd?: string;
  hasAttachments?: true;
  payables?: true;
  isDivided?: true;
  page?: number;
  pageSize?: 5 | 10 | 20 | 30 | 40 | 50 | 100;
};

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const slugListPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:,[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function tagIdList(value: unknown) {
  if (typeof value !== "string" || !value.split(",").every((id) => uuidPattern.test(id)))
    return undefined;
  return [...new Set(value.toLowerCase().split(","))].join(",");
}

function slugList(value: unknown) {
  if (typeof value !== "string" || !slugListPattern.test(value)) return undefined;

  return [...new Set(value.split(","))].join(",");
}

export function validateTransactionsSearch(search: Record<string, unknown>): TransactionsSearch {
  const withoutTags = search.withoutTags === true || search.withoutTags === "true";
  return {
    edit:
      typeof search.edit === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(search.edit)
        ? search.edit
        : undefined,
    period:
      typeof search.period === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(search.period)
        ? search.period
        : undefined,
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    type:
      search.type === "income" || search.type === "expense" || search.type === "transfer"
        ? search.type
        : undefined,
    condition:
      search.condition === "single" ||
      search.condition === "installment" ||
      search.condition === "recurring"
        ? search.condition
        : undefined,
    paymentMethod:
      search.paymentMethod === "credit_card" ||
      search.paymentMethod === "debit_card" ||
      search.paymentMethod === "pix" ||
      search.paymentMethod === "cash" ||
      search.paymentMethod === "boleto" ||
      search.paymentMethod === "benefits" ||
      search.paymentMethod === "bank_transfer"
        ? search.paymentMethod
        : undefined,
    settlement:
      search.settlement === "paid" ||
      search.settlement === "unpaid" ||
      search.settlement === "invoice"
        ? search.settlement
        : undefined,
    sort: ["recent", "oldest", "dueDate", "amount"].includes(String(search.sort))
      ? (search.sort as TransactionsSearch["sort"])
      : undefined,
    people: slugList(search.people),
    categories: slugList(search.categories),
    tags: withoutTags ? undefined : tagIdList(search.tags),
    withoutTags: withoutTags ? true : undefined,
    accounts: slugList(search.accounts),
    cards: slugList(search.cards),
    minAmount: numberSearchValue(search.minAmount),
    maxAmount: numberSearchValue(search.maxAmount),
    dateStart:
      typeof search.dateStart === "string" && datePattern.test(search.dateStart)
        ? search.dateStart
        : undefined,
    dateEnd:
      typeof search.dateEnd === "string" && datePattern.test(search.dateEnd)
        ? search.dateEnd
        : undefined,
    hasAttachments:
      search.hasAttachments === true || search.hasAttachments === "true" ? true : undefined,
    payables: search.payables === true || search.payables === "true" ? true : undefined,
    isDivided: search.isDivided === true || search.isDivided === "true" ? true : undefined,
    page: positiveIntegerSearchValue(search.page),
    pageSize: pageSizeSearchValue(search.pageSize),
  };
}

function numberSearchValue(value: unknown) {
  const amount = typeof value === "string" ? Number(value) : value;

  return typeof amount === "number" && Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

function positiveIntegerSearchValue(value: unknown) {
  const page = typeof value === "string" ? Number(value) : value;

  return typeof page === "number" && Number.isInteger(page) && page > 1 ? page : undefined;
}

function pageSizeSearchValue(value: unknown): TransactionsSearch["pageSize"] {
  const size = typeof value === "string" ? Number(value) : value;

  return size === 5 ||
    size === 10 ||
    size === 20 ||
    size === 30 ||
    size === 40 ||
    size === 50 ||
    size === 100
    ? size
    : undefined;
}

export const transactionTypeLabels: Record<TransactionType, string> = {
  income: "Receita",
  expense: "Despesa",
  transfer: "Transferência",
};

export const transactionConditionLabels: Record<TransactionCondition, string> = {
  single: "Única",
  installment: "Parcelada",
  recurring: "Recorrente",
};

export const transactionOriginLabels: Record<TransactionOrigin, string> = {
  regular: "Lançamento manual",
  invoicePayment: "Pagamento de fatura",
  refund: "Reembolso",
  accountBalanceAdjustment: "Ajuste de saldo",
  invoiceAdjustment: "Ajuste de fatura",
  personSettlement: "Repasse de pessoa",
};

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit_card: "Cartão de crédito",
  debit_card: "Cartão de débito",
  pix: "Pix",
  cash: "Dinheiro",
  boleto: "Boleto",
  benefits: "Benefícios",
  bank_transfer: "Transferência bancária",
};

export function formatPaymentMethod(
  paymentMethod: PaymentMethod | null,
  origin?: TransactionOrigin,
) {
  if (origin === "accountBalanceAdjustment") return "Ajuste de saldo";
  return paymentMethod === null ? "Não se aplica" : paymentMethodLabels[paymentMethod];
}

export function formatPaymentMethodTable(
  paymentMethod: PaymentMethod | null,
  origin?: TransactionOrigin,
) {
  return paymentMethod === "bank_transfer"
    ? "Transf. bancária"
    : formatPaymentMethod(paymentMethod, origin);
}

export const recurrenceFrequencyLabels: Record<RecurrenceFrequency, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

export function formatPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
    month: "long",
    year: "numeric",
  });

  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

export function formatInstallmentOption(count: number, option?: InstallmentOptionOutput) {
  if (!Number.isInteger(count) || count < 2) return "Selecione";
  if (!option) return `${count}x`;
  return option.minimumAmount === option.maximumAmount
    ? `${count}x de ${formatCurrency(option.maximumAmount)}`
    : `${count} parcelas · de ${formatCurrency(option.minimumAmount)} a ${formatCurrency(option.maximumAmount)}`;
}

export function getTransactionDateLabel(type: TransactionType, condition: TransactionCondition) {
  if (condition === "recurring") return "Início da recorrência";
  if (type === "income") return "Data do recebimento";
  if (type === "transfer") return "Data da transferência";
  return "Data da compra";
}

export function formatDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {});
}

export function formatDateTime(value: string) {
  return formatDateInBrazil(new Date(value), {
    dateStyle: "short",
    timeStyle: "short",
  });
}

export function formatCompactDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    weekday: "short",
    day: "2-digit",
    month: "short",
  })
    .replaceAll(".", "")
    .toLocaleLowerCase("pt-BR");
}

function slugifyUrlValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildFilterSlugMap(items: Array<{ id: string; name: string }>) {
  const occurrences = new Map<string, number>();
  const idToSlug = new Map<string, string>();
  const slugToId = new Map<string, string>();

  for (const item of [...items].sort(
    (left, right) =>
      left.name.localeCompare(right.name, "pt-BR", { sensitivity: "base" }) ||
      left.id.localeCompare(right.id),
  )) {
    const base = slugifyUrlValue(item.name) || "sem-nome";
    const count = (occurrences.get(base) ?? 0) + 1;
    const slug = count === 1 ? base : `${base}-${count}`;
    occurrences.set(base, count);
    idToSlug.set(item.id, slug);
    slugToId.set(slug, item.id);
  }

  return { idToSlug, slugToId };
}

export function parseFilterSlugs(value?: string) {
  return value?.split(",").filter(Boolean) ?? [];
}

export function serializeFilterSlugs(values: string[]) {
  return values.length ? values.join(",") : undefined;
}

const transactionMutationErrorMessages: Record<string, string> = {
  INVALID_RECURRING_TRANSITION:
    "A recorrência mudou ou esta data não aceita a ação. Atualize a lista e confira a ocorrência.",
  RECURRING_OCCURRENCE_SETTLED:
    "Há uma baixa registrada nesta ocorrência ou nas próximas. Desfaça a baixa antes de pular, pausar ou encerrar.",
  RECURRING_END_DATE_SCOPE_UNSUPPORTED:
    "A data final deve ser aplicada às próximas ocorrências ou a toda a série.",
  SETTLEMENT_USE_ACTION:
    "Use a ação de pagar, receber ou desfazer a baixa na lista de lançamentos.",
  SETTLEMENT_REQUIRES_UNDO:
    "Desfaça a baixa antes de alterar os dados financeiros deste lançamento.",
  SETTLEMENT_ALREADY_CONFIRMED: "Este lançamento já foi confirmado. Atualize a lista.",
  SETTLEMENT_UNSUPPORTED: "Use o fluxo de pagamento correspondente a este lançamento.",
  BULK_CATEGORY_INCOMPATIBLE: "A categoria não combina com todos os lançamentos. Atualize a lista.",
  BULK_ACTION_UNSUPPORTED: "Alguns lançamentos não aceitam esta ação. Atualize a lista.",
  TAG_LIMIT_EXCEEDED: "Algum lançamento já atingiu o limite de etiquetas.",
  tag_not_found: "Etiqueta não encontrada. Atualize a lista.",
  SETTLEMENT_ACCOUNT_NOT_FOUND: "Escolha uma conta ativa para registrar a baixa.",
  INVALID_SETTLEMENT_AMOUNT: "Informe um valor maior que zero, com até duas casas decimais.",
  RECURRING_NO_FUTURE_OCCURRENCE: "Não há próximas ocorrências dentro da data final configurada.",
  SETTLEMENT_DATE_FUTURE: "A data do pagamento não pode estar no futuro.",
  validation_error: "Revise os campos destacados e tente novamente.",
  CARD_LIMIT_EXCEEDED: "O valor ultrapassa o limite disponível do cartão.",
  INSUFFICIENT_TRANSFER_BALANCE: "O valor ultrapassa o saldo disponível da conta de origem.",
  INVOICE_ALREADY_PAID: "A fatura selecionada já foi paga. Escolha outra fatura.",
  PERSON_NOT_FOUND: "A pessoa selecionada não está mais disponível. Atualize a página.",
  SPLIT_PERSON_NOT_FOUND: "Uma das pessoas da divisão não está mais disponível. Revise a divisão.",
  CATEGORY_NOT_FOUND: "A categoria selecionada não está mais disponível. Escolha outra.",
  ACCOUNT_NOT_FOUND: "A conta selecionada não está mais disponível. Escolha outra.",
  SOURCE_ACCOUNT_NOT_FOUND: "A conta de origem não está mais disponível. Escolha outra.",
  DESTINATION_ACCOUNT_NOT_FOUND: "A conta de destino não está mais disponível. Escolha outra.",
  CARD_NOT_FOUND: "O cartão selecionado não está mais disponível. Escolha outro.",
  TRANSFER_ACCOUNTS_REQUIRED: "Selecione as contas de origem e destino.",
  RECURRING_SCHEDULE_SCOPE_UNSUPPORTED:
    "Para alterar a data ou frequência, escolha esta e as próximas ocorrências.",
  RECURRING_SCHEDULE_OVERLAPS_HISTORY:
    "Escolha uma data posterior à ocorrência anterior para preservar o histórico.",
  RECURRING_SCHEDULE_OUTSIDE_RANGE:
    "Escolha uma data dentro do período ativo ou pausado da recorrência.",
  RECURRING_RULE_CHANGED: "Esta recorrência mudou. Atualize a página e tente novamente.",
  external_expense_state_conflict:
    "Este lançamento compartilhado mudou ou já foi importado. Atualize a página.",
  external_expense_version_conflict:
    "Este lançamento compartilhado foi atualizado. Revise os dados mais recentes.",
  rate_limited: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.",
};

export function getTransactionMutationErrorMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return "Não foi possível concluir. Tente novamente em instantes.";
  }

  const code = error.code;
  return typeof code === "string" && transactionMutationErrorMessages[code]
    ? transactionMutationErrorMessages[code]
    : "Não foi possível concluir. Tente novamente em instantes.";
}

/** Keep the visible shares of one purchase together without joining separate occurrences. */
export function groupTransactionRows<
  T extends Pick<
    TransactionOutput,
    "id" | "isDivided" | "allocation" | "recordId" | "recurringRuleId" | "purchaseDate"
  >,
>(transactions: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const transaction of transactions) {
    const sharedKey =
      transaction.isDivided && transaction.allocation
        ? transaction.recordId
          ? `record:${transaction.recordId}`
          : transaction.recurringRuleId
            ? `occurrence:${transaction.recurringRuleId}:${transaction.purchaseDate}`
            : null
        : null;
    const key = sharedKey ?? `row:${transaction.id}`;
    const group = groups.get(key);
    if (group) group.push(transaction);
    else groups.set(key, [transaction]);
  }
  return [...groups.values()].flatMap((group) =>
    group.map((transaction, index) => ({
      transaction,
      splitConnector:
        group.length < 2
          ? null
          : index === 0
            ? ("start" as const)
            : index === group.length - 1
              ? ("end" as const)
              : ("middle" as const),
    })),
  );
}

export function getTransactionSettlementLabel(
  transaction: Pick<TransactionOutput, "type" | "isSettled" | "paymentMethod">,
) {
  if (transaction.paymentMethod === "credit_card" || transaction.isSettled === null)
    return "Pagamento pela fatura";
  if (!transaction.isSettled) return "Em aberto";
  return transaction.type === "income"
    ? "Recebido"
    : transaction.type === "transfer"
      ? "Realizada"
      : "Pago";
}

export function formatTransactionSettlementSummary(
  transaction: Pick<
    TransactionOutput,
    "type" | "isSettled" | "paymentMethod" | "settledDate" | "dueDate"
  >,
) {
  const label = getTransactionSettlementLabel(transaction);
  if (transaction.paymentMethod === "credit_card" || transaction.isSettled === null) return label;
  if (transaction.isSettled)
    return transaction.settledDate ? `${label} em ${formatDate(transaction.settledDate)}` : label;
  return transaction.dueDate ? `${label} · vence em ${formatDate(transaction.dueDate)}` : label;
}

export function formatTransactionConditionSummary(
  transaction: Pick<
    TransactionOutput,
    "condition" | "currentInstallment" | "installmentCount" | "recurrenceFrequency"
  >,
) {
  if (
    transaction.condition === "installment" &&
    transaction.currentInstallment !== null &&
    transaction.installmentCount !== null
  )
    return `Parcela ${transaction.currentInstallment} de ${transaction.installmentCount}`;
  if (transaction.condition === "recurring" && transaction.recurrenceFrequency)
    return `${transactionConditionLabels.recurring} · ${recurrenceFrequencyLabels[transaction.recurrenceFrequency]}`;
  return transactionConditionLabels[transaction.condition];
}

export function getTransactionSettlementAction(
  transaction: Pick<TransactionOutput, "type" | "isSettled">,
) {
  if (transaction.isSettled)
    return transaction.type === "income"
      ? "Desfazer recebimento"
      : transaction.type === "transfer"
        ? "Desfazer confirmação"
        : "Desfazer pagamento";
  return transaction.type === "income"
    ? "Registrar recebimento"
    : transaction.type === "transfer"
      ? "Confirmar transferência"
      : "Registrar pagamento";
}

export function formatTransactionFilterDate(value: string) {
  return formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export type BulkTransactionSelection = {
  ids: string[];
  transactions: TransactionOutput[];
  skippedCount: number;
};

/**
 * Resolves the persisted records an action can reach. Recurring occurrences have no record yet
 * and split shares repeat their record, so both are collapsed before counting what was skipped.
 */
export function selectBulkTransactionIds(
  transactions: readonly TransactionOutput[],
  accepts: (target: BulkTransactionTarget) => boolean,
): BulkTransactionSelection {
  const records = new Map<string, TransactionOutput | null>();
  for (const transaction of transactions) {
    records.set(
      transaction.recordId ?? `occurrence:${transaction.id}`,
      transaction.recordId ? transaction : null,
    );
  }
  const ids: string[] = [];
  const accepted: TransactionOutput[] = [];
  for (const [recordId, transaction] of records) {
    if (
      transaction &&
      accepts({
        origin: transaction.origin,
        type: transaction.type,
        paymentMethod: transaction.paymentMethod,
        cardId: transaction.cardId,
        isSettled: transaction.isSettled,
        refundedAmount: transaction.refundedAmount,
      })
    ) {
      ids.push(recordId);
      accepted.push(transaction);
    }
  }
  return { ids, transactions: accepted, skippedCount: records.size - ids.length };
}

export function formatBulkTransactionResult(
  action: "categorized" | "renamed" | "tagged" | "untagged" | "deleted" | "settled" | "unsettled",
  selection: BulkTransactionSelection,
) {
  const count = selection.ids.length;
  const plural = count === 1 ? "" : "s";
  const subject = `${count} lançamento${plural}`;
  const title = {
    categorized: `${subject} categorizado${plural}`,
    renamed: `${subject} renomeado${plural}`,
    tagged: `Etiqueta adicionada a ${subject}`,
    untagged: `Etiqueta removida de ${subject}`,
    deleted: `${subject} removido${plural}`,
    settled: `${subject} marcado${plural} como pago${plural}`,
    unsettled: `${subject} marcado${plural} em aberto`,
  }[action];
  if (!selection.skippedCount) return { title };
  return {
    title,
    description: `${selection.skippedCount} ignorado${selection.skippedCount === 1 ? "" : "s"}: recorrentes, gerados pelo sistema ou incompatíveis com a ação.`,
  };
}

export type BulkTransactionActionKey =
  | "settle"
  | "unsettle"
  | "categorize"
  | "tag"
  | "rename"
  | "delete";

const bulkTransactionActionCopy: Record<
  BulkTransactionActionKey,
  { label: string; unavailable: string }
> = {
  settle: {
    label: "Marcar como pago",
    unavailable: "Nenhum selecionado está em aberto fora de cartão",
  },
  unsettle: { label: "Marcar em aberto", unavailable: "Nenhum selecionado está pago" },
  categorize: { label: "Categoria", unavailable: "Nenhum selecionado aceita outra categoria" },
  tag: { label: "Etiquetas", unavailable: "Nenhum selecionado aceita etiquetas" },
  rename: { label: "Descrição", unavailable: "Nenhum selecionado aceita outra descrição" },
  delete: { label: "Excluir", unavailable: "Nenhum selecionado pode ser excluído" },
};

/** Explains how far a bulk action reaches before the user commits to it. */
export function describeBulkTransactionAction(
  action: BulkTransactionActionKey,
  availability: { count: number; total: number },
) {
  const copy = bulkTransactionActionCopy[action];
  const available = availability.count > 0;
  return {
    available,
    label: copy.label,
    unavailableReason: copy.unavailable,
    hint: !available
      ? `${copy.label} · ${copy.unavailable.toLocaleLowerCase("pt-BR")}`
      : availability.count < availability.total
        ? `${copy.label} · ${availability.count} de ${availability.total}`
        : copy.label,
  };
}
