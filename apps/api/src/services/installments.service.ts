import {
  calculateDashboardInstallmentExpenses,
  calculateInstallmentAnticipation,
  calculateInstallmentAnticipationUndo,
  calculateInstallmentQuote,
  calculateInstallmentsReport,
  type InstallmentAnticipationUndoItem,
  type InstallmentReportRow,
  isInstallmentPaid,
} from "@openmonetis/domain/installments";
import type {
  CreateInstallmentAnticipationInput,
  DashboardInstallmentExpensesOutput,
  InstallmentAnticipationDetailsOutput,
  InstallmentAnticipationOutput,
  InstallmentQuoteOutput,
  InstallmentsReportOutput,
  ListInstallmentsQuery,
  QuoteInstallmentsInput,
  UndoInstallmentAnticipationInput,
  UndoInstallmentAnticipationOutput,
} from "@openmonetis/validators/installments";
import { badRequest, conflict, notFound } from "../utils/errors";

export type InstallmentQuoteRecord = {
  id: string;
  userId: string;
  type: "income" | "expense" | "transfer";
  condition: "single" | "installment" | "recurring";
  seriesId: string | null;
  currentInstallment: number | null;
  amount: string | number;
  paymentMethod: InstallmentReportRow["paymentMethod"];
  isSettled: boolean | null;
  invoicePaymentStatus: "pending" | "paid" | null;
  personId: string;
  cardId: string | null;
  categoryId: string | null;
  name: string;
  period: string;
  splitShares: Array<{ personId: string; amount: string | number }>;
};

type InstallmentAnticipationRecord = {
  id: string;
  seriesId: string;
  targetPeriod: string;
  discount: string | number;
  items: Array<
    InstallmentAnticipationUndoItem & {
      installmentNumber: number;
      totalInstallments: number;
      originalPeriod: string;
    }
  >;
};

export type InstallmentsRepository = {
  listForUser(
    userId: string,
    options?: { personScope?: "admin" | "all" },
  ): Promise<InstallmentReportRow[]>;
  findByIdsForUser(ids: string[], userId: string): Promise<InstallmentQuoteRecord[]>;
  createAnticipation(data: {
    userId: string;
    seriesId: string;
    installmentIds: string[];
    targetPeriod: string;
    discount: number;
    discountAllocations: Array<{ personId: string; amount: number }>;
    name: string;
    personId: string;
    cardId: string;
    categoryId: string | null;
  }): Promise<{ id: string } | null>;
  findAnticipationForUser(
    userId: string,
    seriesId: string,
    anticipationId: string,
  ): Promise<InstallmentAnticipationRecord | null>;
  undoAnticipation(data: {
    userId: string;
    seriesId: string;
    anticipationId: string;
    installmentIds: string[];
    expectedInstallmentCount: number;
    expectedDiscount: number;
    remainingDiscount: number;
    remainingDiscountAllocations: Array<{ personId: string; amount: number }>;
  }): Promise<{ id: string } | null>;
};

export function createInstallmentsService(repository: InstallmentsRepository) {
  return {
    async dashboard(userId: string, period: string): Promise<DashboardInstallmentExpensesOutput> {
      const rows = await repository.listForUser(userId, { personScope: "admin" });
      return { period, items: calculateDashboardInstallmentExpenses(rows, period) };
    },

    async list(userId: string, query: ListInstallmentsQuery): Promise<InstallmentsReportOutput> {
      const rows = await repository.listForUser(userId, { personScope: "admin" });
      return calculateInstallmentsReport(rows, {
        referencePeriod: query.period,
        status: query.status,
        q: query.q,
      });
    },

    async quote(userId: string, input: QuoteInstallmentsInput): Promise<InstallmentQuoteOutput> {
      const records = await repository.findByIdsForUser(input.installmentIds, userId);
      const recordsById = new Map(records.map((record) => [record.id, record]));
      const orderedRecords = input.installmentIds.map((id) => recordsById.get(id));

      if (
        recordsById.size !== records.length ||
        orderedRecords.some((record) => !record || record.userId !== userId)
      ) {
        throw badRequest("One or more installments are invalid", "invalid_installment_selection");
      }

      const ownedRecords = orderedRecords.filter(
        (record): record is InstallmentQuoteRecord => record !== undefined,
      );
      if (
        ownedRecords.some(
          (record) =>
            record.type !== "expense" ||
            record.condition !== "installment" ||
            record.seriesId === null ||
            record.currentInstallment === null,
        )
      ) {
        throw badRequest("One or more installments are invalid", "invalid_installment_selection");
      }

      if (ownedRecords.some(isInstallmentPaid)) {
        throw badRequest("Paid installments cannot be quoted", "installment_already_paid");
      }

      return calculateInstallmentQuote(ownedRecords);
    },

    async anticipate(
      userId: string,
      seriesId: string,
      input: CreateInstallmentAnticipationInput,
    ): Promise<InstallmentAnticipationOutput> {
      const records = await repository.findByIdsForUser(input.installmentIds, userId);
      const recordsById = new Map(records.map((record) => [record.id, record]));
      const orderedRecords = input.installmentIds.map((id) => recordsById.get(id));
      if (recordsById.size !== records.length || orderedRecords.some((record) => !record)) {
        throw badRequest("One or more installments are invalid", "invalid_installment_selection");
      }

      const ownedRecords = orderedRecords.filter(
        (record): record is InstallmentQuoteRecord => record !== undefined,
      );
      if (
        ownedRecords.some(
          (record) =>
            record.userId !== userId ||
            record.seriesId !== seriesId ||
            record.type !== "expense" ||
            record.condition !== "installment" ||
            record.paymentMethod !== "credit_card" ||
            !record.cardId ||
            record.period <= input.targetPeriod,
        )
      ) {
        throw badRequest(
          "Only future credit card installments from the same series can be anticipated",
          "installment_not_anticipatable",
        );
      }
      if (ownedRecords.some(isInstallmentPaid)) {
        throw badRequest("Paid installments cannot be anticipated", "installment_already_paid");
      }
      const cardId = ownedRecords[0]?.cardId;
      if (!cardId || ownedRecords.some((record) => record.cardId !== cardId)) {
        throw badRequest("Installments must belong to the same card", "mixed_installment_cards");
      }

      let calculation: ReturnType<typeof calculateInstallmentAnticipation>;
      try {
        calculation = calculateInstallmentAnticipation(ownedRecords, input.discount);
      } catch {
        throw badRequest("Invalid anticipation discount", "invalid_anticipation_discount");
      }
      const first = ownedRecords[0] as InstallmentQuoteRecord;
      const anticipation = await repository.createAnticipation({
        userId,
        seriesId,
        installmentIds: input.installmentIds,
        targetPeriod: input.targetPeriod,
        discount: calculation.discount,
        discountAllocations: calculation.discountAllocations,
        name: first.name,
        personId: first.personId,
        cardId,
        categoryId: first.categoryId,
      });
      if (!anticipation) {
        throw conflict(
          "Installments changed while the anticipation was being registered",
          "installment_anticipation_conflict",
        );
      }

      return {
        id: anticipation.id,
        seriesId,
        targetPeriod: input.targetPeriod,
        installmentCount: calculation.installmentCount,
        totalAmount: calculation.totalAmount,
        discount: calculation.discount,
        finalAmount: calculation.finalAmount,
      };
    },

    async getAnticipation(
      userId: string,
      seriesId: string,
      anticipationId: string,
    ): Promise<InstallmentAnticipationDetailsOutput> {
      const anticipation = await repository.findAnticipationForUser(
        userId,
        seriesId,
        anticipationId,
      );
      if (!anticipation) {
        throw notFound("Anticipation not found", "INSTALLMENT_ANTICIPATION_NOT_FOUND");
      }
      return {
        id: anticipation.id,
        seriesId: anticipation.seriesId,
        targetPeriod: anticipation.targetPeriod,
        discount: Number(anticipation.discount),
        installments: anticipation.items.map((item) => ({
          id: item.id,
          installmentNumber: item.installmentNumber,
          totalInstallments: item.totalInstallments,
          amount: Math.abs(Number(item.amount)),
          originalPeriod: item.originalPeriod,
        })),
      };
    },

    async undoAnticipation(
      userId: string,
      seriesId: string,
      anticipationId: string,
      input: UndoInstallmentAnticipationInput,
    ): Promise<UndoInstallmentAnticipationOutput> {
      const anticipation = await repository.findAnticipationForUser(
        userId,
        seriesId,
        anticipationId,
      );
      if (!anticipation) {
        throw notFound("Anticipation not found", "INSTALLMENT_ANTICIPATION_NOT_FOUND");
      }

      let calculation: ReturnType<typeof calculateInstallmentAnticipationUndo>;
      try {
        calculation = calculateInstallmentAnticipationUndo(
          anticipation.items,
          input.installmentIds,
          Number(anticipation.discount),
        );
      } catch {
        throw badRequest("Invalid anticipation selection", "invalid_installment_selection");
      }
      const undone = await repository.undoAnticipation({
        userId,
        seriesId,
        anticipationId,
        installmentIds: input.installmentIds,
        expectedInstallmentCount: anticipation.items.length,
        expectedDiscount: Number(anticipation.discount),
        remainingDiscount: calculation.remainingDiscount,
        remainingDiscountAllocations: calculation.remainingDiscountAllocations,
      });
      if (!undone) {
        throw badRequest(
          "Anticipation cannot be undone after its invoice is paid or changed",
          "INSTALLMENT_ANTICIPATION_NOT_CANCELLABLE",
        );
      }
      return {
        id: undone.id,
        restoredInstallmentCount: calculation.restoredInstallmentCount,
        remainingInstallmentCount: calculation.remainingInstallmentCount,
        restoredDiscount: calculation.restoredDiscount,
        remainingDiscount: calculation.remainingDiscount,
      };
    },
  };
}

export type InstallmentsService = ReturnType<typeof createInstallmentsService>;
