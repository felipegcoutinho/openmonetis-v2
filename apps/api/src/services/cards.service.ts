import {
  type CardBrand,
  type CardClosingOffsetMode,
  type CardClosingRuleType,
  type CardInvoiceSummary,
  type CardStatus,
  calculateCardInvoiceSummary,
  createCardDraft,
  resolveCardClosingRule,
} from "@openmonetis/domain/cards";
import {
  addMonthsToPeriod,
  deriveTransactionPeriod,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
} from "@openmonetis/domain/transactions";
import { getCurrentDateInBrazil, getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  CardOutput,
  CreateCardInput,
  ReplaceCardInput,
  UpdateCardInput,
} from "@openmonetis/validators/cards";
import { conflict, notFound } from "../utils/errors";

export type CardRecord = {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  brand: CardBrand;
  status: CardStatus;
  closingDay: number | null;
  closingRuleType: CardClosingRuleType;
  closingOffsetDays: number | null;
  closingOffsetMode: CardClosingOffsetMode | null;
  dueDay: number;
  limit: string;
  logo: string | null;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type CardCreateRecord = Omit<CardRecord, "id" | "createdAt" | "updatedAt">;
type CardUpdateRecord = Partial<Omit<CardCreateRecord, "userId">>;

type DeleteCardResult =
  | { status: "active" }
  | { status: "deleted"; id: string }
  | { status: "not_found" };

export type CardMovementRecord = {
  cardId: string | null;
  period: string;
  amount: string;
};

export type CardInvoiceStateRecord = {
  cardId: string;
  period: string;
  paymentStatus: "pending" | "paid";
  closingDate: string | null;
  dueDate: string | null;
  datesCustomized: boolean;
};

type CardInvoicePaymentRecord = {
  cardId: string;
  period: string;
  amount: string;
};

export type CardRecurringRuleRecord = {
  id: string;
  cardId: string | null;
  amount: string;
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

export type CardsRepository = {
  accountExistsForUser(accountId: string, userId: string): Promise<boolean>;
  insert(data: CardCreateRecord): Promise<CardRecord>;
  deleteInactiveForUser(id: string, userId: string): Promise<DeleteCardResult>;
  listByUser(userId: string): Promise<CardRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<CardRecord | null>;
  updateForUser(id: string, userId: string, data: CardUpdateRecord): Promise<CardRecord | null>;
  listMovementsByUser(userId: string, cardId?: string): Promise<CardMovementRecord[]>;
  listInvoiceStatesByUser(userId: string, cardId?: string): Promise<CardInvoiceStateRecord[]>;
  listInvoicePaymentsByUser(userId: string, cardId?: string): Promise<CardInvoicePaymentRecord[]>;
  listActiveRecurringRulesThroughPeriod(
    userId: string,
    periodEnd: Date,
    cardId?: string,
  ): Promise<CardRecurringRuleRecord[]>;
};

function toCardOutput(card: CardRecord, invoiceSummary: CardInvoiceSummary): CardOutput {
  return {
    id: card.id,
    accountId: card.accountId,
    name: card.name,
    brand: card.brand,
    status: card.status,
    closingDay: card.closingDay,
    closingRuleType: card.closingRuleType,
    closingOffsetDays: card.closingOffsetDays,
    closingOffsetMode: card.closingOffsetMode,
    dueDay: card.dueDay,
    limit: Number(card.limit),
    logo: card.logo,
    note: card.note,
    invoiceSummary,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export function createCardsService(
  repository: CardsRepository,
  getToday: () => string = getCurrentDateInBrazil,
) {
  async function assertAccountOwnership(accountId: string, userId: string) {
    if (!(await repository.accountExistsForUser(accountId, userId))) {
      throw notFound("Account not found", "account_not_found");
    }
  }

  async function summarizeCards(cards: CardRecord[], userId: string, period: string) {
    if (!cards.length) return [];
    const cardId = cards.length === 1 ? cards[0]?.id : undefined;
    const [persistedMovements, invoiceStates, invoicePayments, recurringRules] = await Promise.all([
      repository.listMovementsByUser(userId, cardId),
      repository.listInvoiceStatesByUser(userId, cardId),
      repository.listInvoicePaymentsByUser(userId, cardId),
      repository.listActiveRecurringRulesThroughPeriod(userId, getPeriodEnd(period), cardId),
    ]);
    const movements = [
      ...persistedMovements,
      ...expandRecurringInvoiceMovements(recurringRules, period),
    ];
    const movementsByCard = new Map<string, CardMovementRecord[]>();
    const statesByCard = new Map<string, CardInvoiceStateRecord[]>();

    for (const movement of movements) {
      if (!movement.cardId) continue;
      const cardMovements = movementsByCard.get(movement.cardId) ?? [];
      cardMovements.push(movement);
      movementsByCard.set(movement.cardId, cardMovements);
    }
    for (const state of invoiceStates) {
      const cardStates = statesByCard.get(state.cardId) ?? [];
      cardStates.push(state);
      statesByCard.set(state.cardId, cardStates);
    }

    return cards.map((card) => {
      const states = statesByCard.get(card.id) ?? [];
      const selectedState = states.find((state) => state.period === period);
      const hasPayments = invoicePayments.some(
        (payment) => payment.cardId === card.id && payment.period === period,
      );
      return toCardOutput(
        card,
        calculateCardInvoiceSummary({
          period,
          limit: Number(card.limit),
          closingDay: card.closingDay,
          closingRule: resolveCardClosingRule(card),
          dueDay: card.dueDay,
          today: getToday(),
          paymentStatus: selectedState?.paymentStatus ?? "pending",
          persistedClosingDate: selectedState?.closingDate,
          persistedDueDate: selectedState?.dueDate,
          datesCustomized: selectedState?.datesCustomized ?? false,
          hasPayments,
          paidPeriods: states
            .filter((state) => state.paymentStatus === "paid")
            .map((state) => state.period),
          movements: (movementsByCard.get(card.id) ?? []).map((movement) => ({
            period: movement.period,
            amount: Number(movement.amount),
          })),
          payments: invoicePayments
            .filter((payment) => payment.cardId === card.id)
            .map((payment) => ({ period: payment.period, amount: Number(payment.amount) })),
        }),
      );
    });
  }

  async function summarizeCard(card: CardRecord, userId: string, period: string) {
    const [output] = await summarizeCards([card], userId, period);
    return output as CardOutput;
  }

  return {
    async create(input: CreateCardInput, userId: string) {
      await assertAccountOwnership(input.accountId, userId);
      const card = await repository.insert(
        createCardDraft({
          ...input,
          userId,
          ...normalizeClosingConfiguration(input),
          logo: input.logo ?? null,
          note: input.note ?? null,
        }),
      );
      return summarizeCard(card, userId, currentPeriod());
    },

    async list(userId: string, period = currentPeriod()) {
      return summarizeCards(await repository.listByUser(userId), userId, period);
    },

    async get(id: string, userId: string, period = currentPeriod()) {
      const card = await repository.findByIdForUser(id, userId);
      if (!card) throw notFound("Card not found", "card_not_found");
      return summarizeCard(card, userId, period);
    },

    async quoteInvoicePeriod(id: string, userId: string, purchaseDate: string) {
      const card = await repository.findByIdForUser(id, userId);
      if (!card) throw notFound("Card not found", "card_not_found");
      return {
        period: deriveTransactionPeriod({
          paymentMethod: "credit_card",
          purchaseDate,
          card: {
            closingDay: card.closingDay,
            closingRule: resolveCardClosingRule(card),
            dueDay: card.dueDay,
          },
        }),
      };
    },

    async replace(id: string, userId: string, input: ReplaceCardInput) {
      await assertAccountOwnership(input.accountId, userId);
      const card = await repository.updateForUser(id, userId, {
        ...input,
        ...normalizeClosingConfiguration(input),
        name: input.name.trim(),
        logo: input.logo?.trim() || null,
        note: input.note?.trim() || null,
        limit: input.limit.toFixed(2),
      });
      if (!card) throw notFound("Card not found", "card_not_found");
      return summarizeCard(card, userId, currentPeriod());
    },

    async update(id: string, userId: string, input: UpdateCardInput) {
      if (input.accountId !== undefined) await assertAccountOwnership(input.accountId, userId);
      const current = await repository.findByIdForUser(id, userId);
      if (!current) throw notFound("Card not found", "card_not_found");
      const values: CardUpdateRecord = {};
      if (input.accountId !== undefined) values.accountId = input.accountId;
      if (input.name !== undefined) values.name = input.name.trim();
      if (input.brand !== undefined) values.brand = input.brand;
      if (input.status !== undefined) values.status = input.status;
      if (
        input.closingDay !== undefined ||
        input.closingRuleType !== undefined ||
        input.closingOffsetDays !== undefined ||
        input.closingOffsetMode !== undefined
      ) {
        Object.assign(
          values,
          normalizeClosingConfiguration({
            closingRuleType: input.closingRuleType ?? current.closingRuleType,
            closingDay: input.closingDay ?? current.closingDay,
            closingOffsetDays: input.closingOffsetDays ?? current.closingOffsetDays,
            closingOffsetMode: input.closingOffsetMode ?? current.closingOffsetMode,
          }),
        );
      }
      if (input.dueDay !== undefined) values.dueDay = input.dueDay;
      if (input.limit !== undefined) values.limit = input.limit.toFixed(2);
      if (input.logo !== undefined) values.logo = input.logo?.trim() || null;
      if (input.note !== undefined) values.note = input.note?.trim() || null;
      const card = await repository.updateForUser(id, userId, values);
      if (!card) throw notFound("Card not found", "card_not_found");
      return summarizeCard(card, userId, currentPeriod());
    },

    async remove(id: string, userId: string) {
      const result = await repository.deleteInactiveForUser(id, userId);

      if (result.status === "not_found") {
        throw notFound("Card not found", "card_not_found");
      }
      if (result.status === "active") {
        throw conflict("Only inactive cards can be permanently deleted", "card_must_be_inactive");
      }

      return { id: result.id };
    },
  };
}

function normalizeClosingConfiguration(input: {
  closingRuleType: CardClosingRuleType;
  closingDay?: number | null;
  closingOffsetDays?: number | null;
  closingOffsetMode?: CardClosingOffsetMode | null;
}) {
  return input.closingRuleType === "daysBeforeDue"
    ? {
        closingRuleType: input.closingRuleType,
        closingDay: null,
        closingOffsetDays: input.closingOffsetDays ?? 1,
        closingOffsetMode: input.closingOffsetMode ?? "calendarDays",
      }
    : {
        closingRuleType: input.closingRuleType,
        closingDay: input.closingDay ?? 1,
        closingOffsetDays: null,
        closingOffsetMode: null,
      };
}

export type CardsService = ReturnType<typeof createCardsService>;

function currentPeriod() {
  return getCurrentPeriodInBrazil();
}

function getPeriodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

function expandRecurringInvoiceMovements(
  rules: CardRecurringRuleRecord[],
  invoicePeriod: string,
): CardMovementRecord[] {
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
          ? [{ cardId: rule.cardId, period: invoicePeriod, amount: rule.amount }]
          : [],
      ),
    ),
  );
}
