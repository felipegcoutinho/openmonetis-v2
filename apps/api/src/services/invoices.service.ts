import {
  areValidInvoiceDates,
  type CardClosingOffsetMode,
  type CardClosingRuleType,
  calculateCardInvoiceSummary,
  resolveCardClosingRule,
} from "@openmonetis/domain/cards";
import {
  calculateInvoicePersonBalances,
  createInvoiceAdjustmentDraft,
  validateInvoicePaymentAllocations,
} from "@openmonetis/domain/invoices";
import {
  addMonthsToPeriod,
  deriveTransactionPeriod,
  getPeriodEndDate,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type {
  AdjustInvoiceInput,
  CreateInvoicePaymentInput,
  DashboardInvoicesOutput,
  InvoicePaymentOutput,
  UpdateInvoiceDatesInput,
} from "@openmonetis/validators/invoices";
import { badRequest, conflict, notFound } from "../utils/errors";

type InvoiceCardRecord = {
  id: string;
  accountId: string;
  name: string;
  logo: string | null;
  closingDay: number | null;
  closingRuleType: CardClosingRuleType;
  closingOffsetDays: number | null;
  closingOffsetMode: CardClosingOffsetMode | null;
  dueDay: number;
};
type InvoiceAccountRecord = { id: string; name: string; logo: string | null };
type InvoiceMovementRecord = {
  cardId: string | null;
  personId: string;
  personName: string;
  personAvatarUrl: string | null;
  personRole: "admin" | "external";
  amount: string;
};
type InvoiceAllocationRecord = { cardId: string; personId: string; amount: string };
type InvoicePaymentRecord = {
  id: string;
  cardId: string;
  amount: string;
  paidAt: string;
};
type InvoiceDateRecord = {
  cardId: string;
  closingDate: string | null;
  dueDate: string | null;
  datesCustomized: boolean;
};
type InvoiceRecurringMovementRecord = InvoiceMovementRecord & {
  startDate: string;
  endDate?: string | null;
  frequency: RecurrenceFrequency;
  paymentMethod: PaymentMethod;
  dueDate: string | null;
  closingDay: number | null;
  closingRuleType: CardClosingRuleType;
  closingOffsetDays: number | null;
  closingOffsetMode: CardClosingOffsetMode | null;
  dueDay: number;
};
export type InvoicesRepository = {
  listCards(userId: string): Promise<InvoiceCardRecord[]>;
  listAccounts(userId: string): Promise<InvoiceAccountRecord[]>;
  listMovements(userId: string, period: string): Promise<InvoiceMovementRecord[]>;
  listRecurringMovements(
    userId: string,
    periodEnd: Date,
  ): Promise<InvoiceRecurringMovementRecord[]>;
  listPaymentAllocations(userId: string, period: string): Promise<InvoiceAllocationRecord[]>;
  listPayments(userId: string, period: string): Promise<InvoicePaymentRecord[]>;
  listDates(userId: string, period: string): Promise<InvoiceDateRecord[]>;
  findOwnedContext(
    userId: string,
    cardId: string,
    accountId: string | null,
    personIds: string[],
  ): Promise<{
    card: { id: string; name: string } | null;
    account: { id: string; name: string } | null;
    people: { id: string; name: string }[];
    adminPersonId: string | null;
    paymentCategoryId: string | null;
  }>;
  insertPayment(data: {
    userId: string;
    cardId: string;
    cardName: string;
    accountId: string | null;
    adminPersonId: string;
    period: string;
    paidAt: string;
    amount: number;
    adminAmount: number;
    expectedPaidAmount: number;
    remainingAmount: number;
    paymentCategoryId: string | null;
    note: string;
    allocations: { personId: string; amount: number }[];
    closingDate: string;
    dueDate: string;
  }): Promise<{ id: string } | null>;
  upsertDates(data: {
    userId: string;
    cardId: string;
    period: string;
    closingDate: string;
    dueDate: string;
  }): Promise<boolean>;
  deletePayment(
    userId: string,
    cardId: string,
    period: string,
    paymentId: string,
  ): Promise<{ id: string; amount: string } | null>;
  findAdjustmentContext(
    userId: string,
    cardId: string,
    personId: string,
  ): Promise<{
    card: { id: string; name: string } | null;
    personId: string | null;
    categoryId: string | null;
  }>;
  insertAdjustment(data: {
    userId: string;
    cardId: string;
    cardName: string;
    personId: string;
    categoryId: string;
    period: string;
    date: string;
    amount: string;
    type: "income" | "expense";
    note: string;
  }): Promise<{ id: string } | null>;
  reopenInvoice(
    userId: string,
    cardId: string,
    period: string,
  ): Promise<{ reversedPaymentCount: number; reversedAmount: number } | null>;
  deleteAdjustment(
    userId: string,
    cardId: string,
    period: string,
    adjustmentId: string,
  ): Promise<"deleted" | "has_payments" | "not_found">;
};

export function createInvoicesService(
  repository: InvoicesRepository,
  today = getCurrentDateInBrazil,
) {
  async function get(period: string, userId: string): Promise<DashboardInvoicesOutput> {
    const [cards, accounts, persistedMovements, recurringMovements, allocations, payments, dates] =
      await Promise.all([
        repository.listCards(userId),
        repository.listAccounts(userId),
        repository.listMovements(userId, period),
        repository.listRecurringMovements(userId, getPeriodEndDate(period)),
        repository.listPaymentAllocations(userId, period),
        repository.listPayments(userId, period),
        repository.listDates(userId, period),
      ]);
    const movements = [
      ...persistedMovements,
      ...expandRecurringMovements(recurringMovements, period),
    ];
    const items = cards.flatMap((card) => {
      const cardMovements = movements.filter((item) => item.cardId === card.id);
      const people = calculateInvoicePersonBalances(
        cardMovements.map((item) => ({ ...item, amount: Number(item.amount) })),
        allocations
          .filter((item) => item.cardId === card.id)
          .map((item) => ({ personId: item.personId, amount: Number(item.amount) })),
      );
      const amount = people.reduce((sum, item) => sum + item.amount, 0);
      if (amount <= 0) return [];
      const paidAmount = people.reduce((sum, item) => sum + item.paidAmount, 0);
      const remainingAmount = people.reduce((sum, item) => sum + item.remainingAmount, 0);
      const cardPayments = payments.filter((item) => item.cardId === card.id);
      const effectiveDates = dates.find((item) => item.cardId === card.id);
      const summary = calculateCardInvoiceSummary({
        period,
        limit: 0,
        closingDay: card.closingDay,
        closingRule: resolveCardClosingRule(card),
        dueDay: card.dueDay,
        today: today(),
        paymentStatus: remainingAmount === 0 ? "paid" : "pending",
        hasPayments: cardPayments.length > 0,
        datesCustomized: effectiveDates?.datesCustomized ?? false,
        paidPeriods: [],
        movements: cardMovements.map((item) => ({ period, amount: Number(item.amount) })),
        persistedClosingDate: effectiveDates?.closingDate,
        persistedDueDate: effectiveDates?.dueDate,
      });
      return [
        {
          cardId: card.id,
          accountId: card.accountId,
          cardName: card.name,
          logo: card.logo,
          period,
          amount,
          paidAmount,
          remainingAmount,
          status: summary.status,
          closingDate: summary.closingDate,
          dueDate: summary.dueDate,
          paymentCount: cardPayments.length,
          latestPayment: cardPayments[0]
            ? {
                id: cardPayments[0].id,
                amount: Number(cardPayments[0].amount),
                paidAt: cardPayments[0].paidAt,
              }
            : null,
          payments: cardPayments.map((payment) => ({
            id: payment.id,
            amount: Number(payment.amount),
            paidAt: payment.paidAt,
          })),
          people,
        },
      ];
    });
    return {
      period,
      totalRemaining: money(items.reduce((sum, item) => sum + item.remainingAmount, 0)),
      accounts,
      items,
    };
  }

  return {
    get,
    async pay(
      cardId: string,
      period: string,
      input: CreateInvoicePaymentInput,
      userId: string,
    ): Promise<InvoicePaymentOutput> {
      if (input.paidAt > today())
        throw badRequest("Payment date cannot be in the future", "invoice_payment_date_future");
      const snapshot = await get(period, userId);
      const invoice = snapshot.items.find((item) => item.cardId === cardId);
      if (!invoice) throw notFound("Invoice not found", "invoice_not_found");
      let totalAmount: number;
      try {
        totalAmount = validateInvoicePaymentAllocations(
          invoice.people,
          input.allocations,
        ).totalAmount;
      } catch {
        throw badRequest("Invalid payment amount", "invalid_invoice_payment_amount");
      }
      const context = await repository.findOwnedContext(
        userId,
        cardId,
        input.accountId ?? null,
        input.allocations.map((item) => item.personId),
      );
      if (!context.card) throw notFound("Card not found", "card_not_found");
      if (
        !context.adminPersonId ||
        context.people.length !== new Set(input.allocations.map((item) => item.personId)).size
      )
        throw notFound("Person not found", "person_not_found");
      const adminAmount = money(
        input.allocations
          .filter((allocation) => allocation.personId === context.adminPersonId)
          .reduce((sum, allocation) => sum + allocation.amount, 0),
      );
      if (input.accountId && !context.account)
        throw notFound("Account not found", "account_not_found");
      if (adminAmount > 0 && !context.account) {
        throw badRequest(
          "Payment account is required for the primary person allocation",
          "invoice_payment_account_required",
        );
      }
      if (adminAmount > 0 && !context.paymentCategoryId)
        throw notFound("Payment category not found", "payment_category_not_found");
      const paymentAccount = adminAmount > 0 ? context.account : null;
      const remainingAmount = money(invoice.remainingAmount - totalAmount);
      const payment = await repository.insertPayment({
        userId,
        cardId,
        cardName: context.card.name,
        accountId: paymentAccount?.id ?? null,
        adminPersonId: context.adminPersonId,
        period,
        paidAt: input.paidAt,
        amount: totalAmount,
        adminAmount,
        expectedPaidAmount: invoice.paidAmount,
        remainingAmount,
        paymentCategoryId: context.paymentCategoryId,
        note: createInvoicePaymentNote({
          cardName: context.card.name,
          accountName: paymentAccount?.name ?? null,
          accountAmount: adminAmount,
          allocations: input.allocations,
          people: context.people,
          totalAmount,
          remainingAmount,
        }),
        allocations: input.allocations,
        closingDate: invoice.closingDate,
        dueDate: invoice.dueDate,
      });
      if (!payment) {
        throw conflict(
          "Invoice changed while payment was being registered",
          "invoice_payment_conflict",
        );
      }
      return {
        id: payment.id,
        amount: totalAmount,
        accountAmount: adminAmount,
        remainingAmount,
        status: remainingAmount === 0 ? "paid" : invoice.status,
      };
    },
    async undo(cardId: string, period: string, paymentId: string, userId: string) {
      const payment = await repository.deletePayment(userId, cardId, period, paymentId);
      if (!payment) throw notFound("Invoice payment not found", "invoice_payment_not_found");
      return { id: payment.id, amount: Number(payment.amount) };
    },
    async adjust(cardId: string, period: string, input: AdjustInvoiceInput, userId: string) {
      if (input.date > today()) {
        throw badRequest(
          "Adjustment date cannot be in the future",
          "invoice_adjustment_date_future",
        );
      }
      if (!input.date.startsWith(`${period}-`)) {
        throw badRequest(
          "Adjustment date must belong to the invoice period",
          "invalid_invoice_adjustment_date",
        );
      }
      const snapshot = await get(period, userId);
      const ownedCard = (await repository.listCards(userId)).find((card) => card.id === cardId);
      if (!ownedCard) throw notFound("Card not found", "card_not_found");

      const invoice = snapshot.items.find((item) => item.cardId === cardId);
      if ((invoice?.paymentCount ?? 0) > 0) {
        throw conflict(
          "Invoice payments must be reopened before adjusting the invoice",
          "invoice_requires_reopen",
        );
      }
      const previousAmount = money(invoice?.amount ?? 0);
      const currentAmount = money(input.amount);
      if (currentAmount < (invoice?.paidAmount ?? 0)) {
        throw badRequest(
          "Adjusted amount cannot be lower than the paid amount",
          "invoice_adjustment_below_paid_amount",
        );
      }
      const adjustment = createInvoiceAdjustmentDraft(previousAmount, currentAmount);
      if (!adjustment) {
        return { id: null, previousAmount, currentAmount, adjustmentAmount: 0, type: null };
      }

      const context = await repository.findAdjustmentContext(userId, cardId, input.personId);
      if (!context.card) throw notFound("Card not found", "card_not_found");
      if (!context.personId) throw notFound("Person not found", "person_not_found");
      if (!context.categoryId) {
        throw notFound("Adjustment category not found", "invoice_adjustment_category_not_found");
      }
      const adjustmentAmount = Number(adjustment.amount);
      const selectedPersonAmount =
        invoice?.people.find((person) => person.personId === context.personId)?.amount ?? 0;
      if (adjustmentAmount > 0 && money(selectedPersonAmount) < money(adjustmentAmount)) {
        throw badRequest(
          "Invoice reduction exceeds the selected person's amount",
          "invoice_adjustment_exceeds_person_amount",
        );
      }

      const inserted = await repository.insertAdjustment({
        userId,
        cardId,
        cardName: context.card.name,
        personId: context.personId,
        categoryId: context.categoryId,
        period,
        date: input.date,
        amount: adjustment.amount,
        type: adjustment.type,
        note: createInvoiceAdjustmentNote(previousAmount, currentAmount),
      });
      if (!inserted) {
        throw conflict(
          "Invoice payments must be reopened before adjusting the invoice",
          "invoice_requires_reopen",
        );
      }

      return {
        id: inserted.id,
        previousAmount,
        currentAmount,
        adjustmentAmount: Math.abs(adjustmentAmount),
        type: adjustment.type,
      };
    },
    async reopen(cardId: string, period: string, userId: string) {
      const result = await repository.reopenInvoice(userId, cardId, period);
      if (!result) throw notFound("Card not found", "card_not_found");
      return result;
    },
    async removeAdjustment(cardId: string, period: string, adjustmentId: string, userId: string) {
      const result = await repository.deleteAdjustment(userId, cardId, period, adjustmentId);
      if (result === "has_payments") {
        throw conflict(
          "Invoice payments must be reopened before removing an adjustment",
          "invoice_requires_reopen",
        );
      }
      if (result === "not_found") {
        throw notFound("Invoice adjustment not found", "invoice_adjustment_not_found");
      }
      return { id: adjustmentId };
    },
    async updateDates(
      cardId: string,
      period: string,
      input: UpdateInvoiceDatesInput,
      userId: string,
    ) {
      if (!areValidInvoiceDates(input)) {
        throw badRequest("Closing date must precede due date", "invalid_invoice_dates");
      }
      const cards = await repository.listCards(userId);
      if (!cards.some((card) => card.id === cardId)) {
        throw notFound("Card not found", "card_not_found");
      }
      const updated = await repository.upsertDates({ userId, cardId, period, ...input });
      if (!updated) throw notFound("Card not found", "card_not_found");
      return input;
    },
  };
}
export type InvoicesService = ReturnType<typeof createInvoicesService>;
function money(value: number) {
  return Math.round(value * 100) / 100;
}

function createInvoicePaymentNote(input: {
  cardName: string;
  accountName: string | null;
  accountAmount: number;
  allocations: { personId: string; amount: number }[];
  people: { id: string; name: string }[];
  totalAmount: number;
  remainingAmount: number;
}) {
  const peopleById = new Map(input.people.map((person) => [person.id, person.name]));
  const paymentKind = input.remainingAmount === 0 ? "total" : "parcial";
  const allocations = input.allocations
    .map(
      (allocation) =>
        `${peopleById.get(allocation.personId) ?? "Pessoa"}: ${formatCurrency(allocation.amount)}`,
    )
    .join("; ");

  return [
    `Pagamento ${paymentKind} da fatura ${input.cardName}.`,
    input.accountName && input.accountAmount > 0
      ? `Parcela da pessoa principal movimentada pela conta ${input.accountName}: ${formatCurrency(input.accountAmount)}.`
      : "Pagamento de pessoa externa, sem movimentação em conta financeira.",
    `Rateio: ${allocations}.`,
    `Valor pago: ${formatCurrency(input.totalAmount)}.`,
    input.remainingAmount > 0
      ? `Saldo restante da fatura: ${formatCurrency(input.remainingAmount)}.`
      : "Fatura quitada integralmente.",
  ].join(" ");
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function createInvoiceAdjustmentNote(previousAmount: number, currentAmount: number) {
  return `Ajuste de fatura. Valor anterior: ${formatCurrency(previousAmount)}. Valor atual: ${formatCurrency(currentAmount)}.`;
}

function expandRecurringMovements(
  rules: InvoiceRecurringMovementRecord[],
  invoicePeriod: string,
): InvoiceMovementRecord[] {
  const purchasePeriods = [
    addMonthsToPeriod(invoicePeriod, -2),
    addMonthsToPeriod(invoicePeriod, -1),
    invoicePeriod,
  ];
  return rules.flatMap((rule) =>
    purchasePeriods.flatMap((purchasePeriod) =>
      listRecurrenceDatesInPeriod({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: purchasePeriod,
      }).flatMap((purchaseDate) =>
        deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate: rule.dueDate,
          card: {
            closingDay: rule.closingDay,
            closingRule: resolveCardClosingRule(rule),
            dueDay: rule.dueDay,
          },
        }) === invoicePeriod
          ? [
              {
                cardId: rule.cardId,
                personId: rule.personId,
                personName: rule.personName,
                personAvatarUrl: rule.personAvatarUrl,
                personRole: rule.personRole,
                amount: rule.amount,
              },
            ]
          : [],
      ),
    ),
  );
}
