import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { PersonOutput } from "@openmonetis/validators/people";
import {
  type TransactionInput,
  TransactionInputSchema,
  type TransactionOutput,
  type UpdateTransactionInput,
} from "@openmonetis/validators/transactions";

export type TransactionFormValues = {
  type: TransactionInput["type"];
  condition: NonNullable<TransactionInput["condition"]>;
  paymentMethod: TransactionInput["paymentMethod"];
  name: string;
  amount: string;
  purchaseDate: string;
  invoicePeriod: string;
  personId: string;
  accountId: string;
  cardId: string;
  categoryId: string;
  sourceAccountId: string;
  destinationAccountId: string;
  dueDate: string;
  boletoPaymentDate: string;
  installmentCount: string;
  startInstallment: string;
  recurrenceFrequency: NonNullable<TransactionInput["recurrenceFrequency"]>;
  isSettled: "true" | "false";
  note: string;
  splitShares: Array<{ personId: string; amount: string }>;
};

export type TransactionCreateDefaults = Partial<
  Pick<
    TransactionFormValues,
    | "accountId"
    | "cardId"
    | "categoryId"
    | "condition"
    | "dueDate"
    | "boletoPaymentDate"
    | "installmentCount"
    | "paymentMethod"
    | "personId"
    | "sourceAccountId"
    | "invoicePeriod"
    | "isSettled"
    | "name"
    | "amount"
    | "purchaseDate"
    | "startInstallment"
  >
>;

type TransactionFieldName = keyof TransactionFormValues;

const today = getCurrentDateInBrazil();

const transactionFieldMessages: Record<TransactionFieldName, string> = {
  type: "Selecione o tipo.",
  condition: "Selecione a condição.",
  paymentMethod: "Selecione a forma de pagamento.",
  name: "Informe uma descrição com até 160 caracteres.",
  amount: "Informe um valor maior que zero.",
  purchaseDate: "Informe a data.",
  invoicePeriod: "Selecione a fatura.",
  personId: "Selecione uma pessoa.",
  accountId: "Selecione uma conta.",
  cardId: "Selecione um cartão.",
  categoryId: "Selecione uma categoria.",
  sourceAccountId: "Selecione a conta de origem.",
  destinationAccountId: "Selecione a conta de destino.",
  dueDate: "Informe uma data válida.",
  boletoPaymentDate: "Informe uma data de pagamento válida.",
  installmentCount: "Informe a quantidade de parcelas.",
  startInstallment: "Selecione uma parcela inicial válida.",
  recurrenceFrequency: "Selecione a frequência.",
  isSettled: "Selecione o status.",
  note: "A observação deve ter até 1000 caracteres.",
  splitShares: "Confira a divisão entre as pessoas.",
};

export function getDefaultTransactionFormValues(
  accounts: AccountOutput[],
  cards: CardOutput[],
  people: PersonOutput[],
  type: TransactionInput["type"] = "expense",
  _period: string = today.slice(0, 7),
  defaults: TransactionCreateDefaults = {},
): TransactionFormValues {
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const activeCards = cards.filter((card) => card.status === "active");
  const activePeople = people.filter((person) => person.status === "active");
  const personId =
    activePeople.find((person) => person.id === defaults.personId)?.id ??
    activePeople.find((person) => person.role === "admin")?.id ??
    activePeople[0]?.id ??
    "";
  const accountId = defaults.accountId ?? activeAccounts[0]?.id ?? "";

  return {
    type,
    condition: defaults.condition ?? "single",
    paymentMethod:
      type === "transfer" ? "bank_transfer" : (defaults.paymentMethod ?? "credit_card"),
    name: defaults.name ?? "",
    amount: defaults.amount ?? "",
    purchaseDate: defaults.purchaseDate ?? today,
    invoicePeriod: defaults.invoicePeriod ?? "",
    personId,
    accountId,
    cardId: defaults.cardId ?? activeCards[0]?.id ?? "",
    categoryId: defaults.categoryId ?? "",
    sourceAccountId: defaults.sourceAccountId ?? accountId,
    destinationAccountId: "",
    dueDate: defaults.dueDate ?? "",
    boletoPaymentDate:
      defaults.boletoPaymentDate ??
      (defaults.paymentMethod === "boleto" && defaults.isSettled !== "false" ? today : ""),
    installmentCount: defaults.installmentCount ?? "2",
    startInstallment: defaults.startInstallment ?? "1",
    recurrenceFrequency: "monthly",
    isSettled: defaults.isSettled ?? "false",
    note: "",
    splitShares: [],
  };
}

export function getTransactionFormValuesFromTransaction(
  transaction: TransactionOutput,
  accounts: AccountOutput[],
  cards: CardOutput[],
  people: PersonOutput[],
  mode: "edit" | "copy" = "edit",
): TransactionFormValues {
  const installmentCopyMultiplier =
    mode === "copy" && transaction.condition === "installment" && transaction.installmentCount
      ? transaction.installmentCount
      : 1;

  return {
    ...getDefaultTransactionFormValues(accounts, cards, people),
    type: transaction.type,
    condition: transaction.condition,
    paymentMethod: transaction.paymentMethod ?? "bank_transfer",
    name: transaction.name,
    amount: String(transaction.displayAmount * installmentCopyMultiplier),
    purchaseDate: transaction.purchaseDate,
    invoicePeriod: transaction.period,
    personId: transaction.personId,
    accountId: transaction.accountId ?? "",
    cardId: transaction.cardId ?? "",
    categoryId: transaction.categoryId ?? "",
    sourceAccountId: transaction.sourceAccountId ?? "",
    destinationAccountId: transaction.destinationAccountId ?? "",
    dueDate: transaction.dueDate ?? "",
    boletoPaymentDate:
      mode === "copy"
        ? transaction.paymentMethod === "boleto" && transaction.isSettled
          ? today
          : ""
        : (transaction.boletoPaymentDate ?? ""),
    installmentCount: transaction.installmentCount ? String(transaction.installmentCount) : "2",
    startInstallment: transaction.currentInstallment ? String(transaction.currentInstallment) : "1",
    recurrenceFrequency: transaction.recurrenceFrequency ?? "monthly",
    isSettled: transaction.isSettled === false ? "false" : "true",
    note: transaction.note ?? "",
    splitShares: transaction.splitShares.map((share) => ({
      personId: share.personId,
      amount: String(share.amount * installmentCopyMultiplier),
    })),
  };
}

export function normalizeTransactionInput(
  value: TransactionFormValues,
  options: { includeStartInstallment?: boolean } = {},
): TransactionInput {
  const isTransfer = value.type === "transfer";
  const isCreditCard = value.paymentMethod === "credit_card";
  const isBoleto = value.paymentMethod === "boleto";

  return TransactionInputSchema.parse({
    type: value.type,
    condition: value.condition,
    paymentMethod: value.paymentMethod,
    name: value.name,
    amount: Number(value.amount),
    purchaseDate: value.purchaseDate,
    invoicePeriod:
      isCreditCard && value.condition !== "recurring" ? value.invoicePeriod || null : null,
    personId: value.personId,
    accountId: !isTransfer && !isCreditCard ? value.accountId || null : null,
    cardId: isCreditCard ? value.cardId || null : null,
    categoryId: !isTransfer ? value.categoryId || null : null,
    sourceAccountId: isTransfer ? value.sourceAccountId || null : null,
    destinationAccountId: isTransfer ? value.destinationAccountId || null : null,
    dueDate: isBoleto && value.dueDate ? value.dueDate : null,
    boletoPaymentDate:
      isBoleto &&
      value.condition !== "recurring" &&
      value.isSettled === "true" &&
      value.boletoPaymentDate
        ? value.boletoPaymentDate
        : null,
    installmentCount: value.condition === "installment" ? Number(value.installmentCount) : null,
    startInstallment:
      options.includeStartInstallment !== false && value.condition === "installment"
        ? Number(value.startInstallment)
        : undefined,
    recurrenceFrequency: value.condition === "recurring" ? value.recurrenceFrequency : null,
    isSettled: isCreditCard ? null : value.isSettled === "true",
    note: value.note.trim() || null,
    splitShares: value.splitShares.length
      ? value.splitShares.map((share) => ({
          personId: share.personId,
          amount: Number(share.amount),
        }))
      : null,
  });
}

export function validateTransactionName(value: string) {
  const name = value.trim();

  if (!name) {
    return "Informe a descrição.";
  }

  if (name.length > 160) {
    return "A descrição deve ter até 160 caracteres.";
  }
}

export function validateTransactionAmount(value: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Informe um valor maior que zero.";
  }
}

export function validateTransactionForm({ value }: { value: TransactionFormValues }) {
  const result = TransactionInputSchema.safeParse({
    ...normalizeLooseTransactionInput(value),
  });

  if (
    result.success &&
    !(
      value.paymentMethod === "boleto" &&
      value.boletoPaymentDate &&
      value.boletoPaymentDate > getCurrentDateInBrazil()
    )
  ) {
    return;
  }

  const fields: Partial<Record<TransactionFieldName, string>> = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const fieldName = issue.path[0] as TransactionFieldName;
      fields[fieldName] = transactionFieldMessages[fieldName];
    }
  }

  if (
    value.paymentMethod === "boleto" &&
    value.boletoPaymentDate &&
    value.boletoPaymentDate > getCurrentDateInBrazil()
  ) {
    fields.boletoPaymentDate = "A data do pagamento não pode estar no futuro.";
  }

  return { fields };
}

export function getTransactionFormErrorMessage(fieldName: TransactionFieldName, errors: unknown[]) {
  if (errors.length === 0) {
    return undefined;
  }

  const firstError = errors[0];

  if (typeof firstError === "string") {
    return firstError;
  }

  return transactionFieldMessages[fieldName];
}

export function getChangedTransactionInput(
  data: TransactionInput,
  value: TransactionFormValues,
  defaults: TransactionFormValues,
): UpdateTransactionInput {
  return {
    ...(value.type !== defaults.type ? { type: data.type } : {}),
    ...(value.condition !== defaults.condition ? { condition: data.condition } : {}),
    ...(value.paymentMethod !== defaults.paymentMethod
      ? { paymentMethod: data.paymentMethod }
      : {}),
    ...(value.name !== defaults.name ? { name: data.name } : {}),
    ...(value.amount !== defaults.amount ? { amount: data.amount } : {}),
    ...(value.purchaseDate !== defaults.purchaseDate ? { purchaseDate: data.purchaseDate } : {}),
    ...(value.invoicePeriod !== defaults.invoicePeriod
      ? { invoicePeriod: data.invoicePeriod }
      : {}),
    ...(value.personId !== defaults.personId ? { personId: data.personId } : {}),
    ...(value.accountId !== defaults.accountId ? { accountId: data.accountId } : {}),
    ...(value.cardId !== defaults.cardId ? { cardId: data.cardId } : {}),
    ...(value.categoryId !== defaults.categoryId ? { categoryId: data.categoryId } : {}),
    ...(value.sourceAccountId !== defaults.sourceAccountId
      ? { sourceAccountId: data.sourceAccountId }
      : {}),
    ...(value.destinationAccountId !== defaults.destinationAccountId
      ? { destinationAccountId: data.destinationAccountId }
      : {}),
    ...(value.dueDate !== defaults.dueDate ? { dueDate: data.dueDate } : {}),
    ...(value.boletoPaymentDate !== defaults.boletoPaymentDate
      ? { boletoPaymentDate: data.boletoPaymentDate }
      : {}),
    ...(value.installmentCount !== defaults.installmentCount
      ? { installmentCount: data.installmentCount }
      : {}),
    ...(value.recurrenceFrequency !== defaults.recurrenceFrequency
      ? { recurrenceFrequency: data.recurrenceFrequency }
      : {}),
    ...(value.isSettled !== defaults.isSettled ? { isSettled: data.isSettled } : {}),
    ...(value.note !== defaults.note ? { note: data.note } : {}),
    ...(JSON.stringify(value.splitShares) !== JSON.stringify(defaults.splitShares)
      ? { splitShares: data.splitShares }
      : {}),
  };
}

export function getTrackedInstallmentHelper(total: number, start: number) {
  if (
    !Number.isInteger(total) ||
    total < 2 ||
    !Number.isInteger(start) ||
    start < 1 ||
    start > total
  ) {
    return "Selecione de qual parcela deseja começar.";
  }

  const tracked = total - start + 1;
  if (start === 1) {
    return `Todas as ${tracked} parcelas serão cadastradas; nenhuma ficará fora do acompanhamento.`;
  }

  const previous = start - 1;
  return `${tracked} ${tracked === 1 ? "parcela será cadastrada" : "parcelas serão cadastradas"}; ${previous} ${previous === 1 ? "anterior ficará" : "anteriores ficarão"} fora do acompanhamento.`;
}

function normalizeLooseTransactionInput(value: TransactionFormValues) {
  const isTransfer = value.type === "transfer";
  const isCreditCard = value.paymentMethod === "credit_card";
  const isBoleto = value.paymentMethod === "boleto";

  return {
    type: value.type,
    condition: value.condition,
    paymentMethod: value.paymentMethod,
    name: value.name,
    amount: Number(value.amount),
    purchaseDate: value.purchaseDate,
    invoicePeriod:
      isCreditCard && value.condition !== "recurring" ? value.invoicePeriod || null : null,
    personId: value.personId,
    accountId: !isTransfer && !isCreditCard ? value.accountId || null : null,
    cardId: isCreditCard ? value.cardId || null : null,
    categoryId: !isTransfer ? value.categoryId || null : null,
    sourceAccountId: isTransfer ? value.sourceAccountId || null : null,
    destinationAccountId: isTransfer ? value.destinationAccountId || null : null,
    dueDate: isBoleto && value.dueDate ? value.dueDate : null,
    boletoPaymentDate:
      isBoleto &&
      value.condition !== "recurring" &&
      value.isSettled === "true" &&
      value.boletoPaymentDate
        ? value.boletoPaymentDate
        : null,
    installmentCount: value.condition === "installment" ? Number(value.installmentCount) : null,
    startInstallment:
      value.condition === "installment" ? Number(value.startInstallment) : undefined,
    recurrenceFrequency: value.condition === "recurring" ? value.recurrenceFrequency : null,
    isSettled: isCreditCard ? null : value.isSettled === "true",
    note: value.note,
    splitShares: value.splitShares.length
      ? value.splitShares.map((share) => ({
          personId: share.personId,
          amount: Number(share.amount),
        }))
      : null,
  };
}
