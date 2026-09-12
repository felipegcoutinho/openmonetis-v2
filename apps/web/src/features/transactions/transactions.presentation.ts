import { splitAmountIntoInstallments } from "@openmonetis/domain/transactions";
import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";

type TransactionType = TransactionInput["type"];
type TransactionCondition = NonNullable<TransactionInput["condition"]>;
type PaymentMethod = TransactionInput["paymentMethod"];
type RecurrenceFrequency = NonNullable<TransactionInput["recurrenceFrequency"]>;
type TransactionOrigin = TransactionOutput["origin"];

export type TransactionsSearch = {
  edit?: string;
  period?: string;
  q?: string;
  type?: TransactionType;
  condition?: TransactionCondition;
  paymentMethod?: PaymentMethod;
  settlement?: "paid" | "unpaid";
  people?: string;
  categories?: string;
  accounts?: string;
  cards?: string;
  minAmount?: number;
  maxAmount?: number;
  dateStart?: string;
  dateEnd?: string;
  hasAttachments?: true;
  isDivided?: true;
  page?: number;
  pageSize?: 5 | 10 | 20 | 30 | 40 | 50 | 100;
};

const datePattern = /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/;
const slugListPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:,[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function slugList(value: unknown) {
  if (typeof value !== "string" || !slugListPattern.test(value)) return undefined;

  return [...new Set(value.split(","))].join(",");
}

export function validateTransactionsSearch(search: Record<string, unknown>): TransactionsSearch {
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
      search.settlement === "paid" || search.settlement === "unpaid"
        ? search.settlement
        : undefined,
    people: slugList(search.people),
    categories: slugList(search.categories),
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
  single: "À vista",
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

export function getCurrentPeriod() {
  return getCurrentPeriodInBrazil();
}

export function formatPeriod(period: string) {
  const label = formatDateInBrazil(periodToSafeInstant(period), {
    month: "long",
    year: "numeric",
  });

  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatInstallmentOption(amount: number, count: number) {
  if (!Number.isInteger(count) || count < 2) return "Selecione";
  if (!Number.isFinite(amount) || amount <= 0) return `${count}x`;

  const installments = splitAmountIntoInstallments(amount, count);
  const smallest = Math.min(...installments);
  const largest = Math.max(...installments);

  return smallest === largest
    ? `${count}x de ${formatCurrency(largest)}`
    : `${count} parcelas · de ${formatCurrency(smallest)} a ${formatCurrency(largest)}`;
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
