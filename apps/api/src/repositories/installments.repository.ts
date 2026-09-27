import {
  cards,
  categories,
  db,
  financialAccounts,
  installmentAnticipationItems,
  installmentAnticipations,
  installmentSeries,
  invoicePayments,
  invoices,
  people,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import { calculateInstallmentAllocationTotal } from "@openmonetis/domain/installments";
import { and, asc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { InstallmentsRepository } from "../services/installments.service";

const transactionAccounts = alias(financialAccounts, "installment_transaction_accounts");
const cardAccounts = alias(financialAccounts, "installment_card_accounts");

export const installmentsRepository = {
  async listForUser(userId, options) {
    const adminScope = options?.personScope === "admin";
    const rows = await db
      .select({
        id: transactions.id,
        seriesId: installmentSeries.id,
        name: transactions.name,
        note: transactions.note,
        amount: transactions.amount,
        adminAmount: sql<string | null>`case
          when exists (
            select 1 from ${transactionSplits}
            where ${transactionSplits.userId} = ${userId}
              and ${transactionSplits.transactionId} = ${transactions.id}
          ) then (
            select ${transactionSplits.amount}
            from ${transactionSplits}
            inner join ${people}
              on ${people.id} = ${transactionSplits.personId}
              and ${people.userId} = ${userId}
              and ${people.role} = 'admin'
            where ${transactionSplits.userId} = ${userId}
              and ${transactionSplits.transactionId} = ${transactions.id}
            limit 1
          )
          when ${people.role} = 'admin' then ${transactions.amount}
          else null
        end`.as("admin_amount"),
        adminPersonId:
          sql<string>`(select ${people.id} from ${people} where ${people.userId} = ${userId} and ${people.role} = 'admin' limit 1)`.as(
            "admin_person_id",
          ),
        adminPersonName:
          sql<string>`(select ${people.name} from ${people} where ${people.userId} = ${userId} and ${people.role} = 'admin' limit 1)`.as(
            "admin_person_name",
          ),
        adminPersonAvatarUrl: sql<
          string | null
        >`(select ${people.avatarUrl} from ${people} where ${people.userId} = ${userId} and ${people.role} = 'admin' limit 1)`.as(
          "admin_person_avatar_url",
        ),
        purchaseDate: transactions.purchaseDate,
        period: transactions.period,
        dueDate: transactions.dueDate,
        currentInstallment: transactions.currentInstallment,
        paymentMethod: transactions.paymentMethod,
        isSettled: transactions.isSettled,
        invoicePaymentStatus: invoices.paymentStatus,
        totalInstallments: installmentSeries.totalInstallments,
        trackedFromInstallment: installmentSeries.trackedFromInstallment,
        originalAmount: installmentSeries.originalAmount,
        personId: people.id,
        personName: people.name,
        personAvatarUrl: people.avatarUrl,
        categoryId: categories.id,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        cardId: cards.id,
        cardName: cards.name,
        cardLogo: cards.logo,
        cardDueDay: cards.dueDay,
        transactionAccountId: transactionAccounts.id,
        transactionAccountName: transactionAccounts.name,
        transactionAccountLogo: transactionAccounts.logo,
        cardAccountId: cardAccounts.id,
        cardAccountName: cardAccounts.name,
        cardAccountLogo: cardAccounts.logo,
      })
      .from(transactions)
      .innerJoin(
        installmentSeries,
        and(eq(transactions.seriesId, installmentSeries.id), eq(installmentSeries.userId, userId)),
      )
      .innerJoin(people, and(eq(transactions.personId, people.id), eq(people.userId, userId)))
      .leftJoin(
        categories,
        and(eq(transactions.categoryId, categories.id), eq(categories.userId, userId)),
      )
      .leftJoin(cards, and(eq(transactions.cardId, cards.id), eq(cards.userId, userId)))
      .leftJoin(
        transactionAccounts,
        and(
          eq(transactions.accountId, transactionAccounts.id),
          eq(transactionAccounts.userId, userId),
        ),
      )
      .leftJoin(
        cardAccounts,
        and(eq(cards.accountId, cardAccounts.id), eq(cardAccounts.userId, userId)),
      )
      .leftJoin(
        invoices,
        and(
          eq(invoices.userId, userId),
          eq(invoices.cardId, transactions.cardId),
          eq(invoices.period, transactions.period),
        ),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          eq(transactions.condition, "installment"),
          isNotNull(transactions.seriesId),
          isNotNull(transactions.currentInstallment),
        ),
      )
      .orderBy(asc(installmentSeries.id), asc(transactions.currentInstallment));

    const adminOriginalAmounts = new Map<string, number>();
    if (adminScope) {
      const rowsBySeries = new Map<string, typeof rows>();
      for (const row of rows) {
        const seriesRows = rowsBySeries.get(row.seriesId);
        if (seriesRows) seriesRows.push(row);
        else rowsBySeries.set(row.seriesId, [row]);
      }

      for (const [seriesId, seriesRows] of rowsBySeries) {
        const allocatedRows = seriesRows.filter((row) => row.adminAmount !== null);
        const representative = allocatedRows[0];
        if (!representative) continue;

        adminOriginalAmounts.set(
          seriesId,
          calculateInstallmentAllocationTotal({
            originalTransactionAmount: representative.originalAmount,
            totalInstallments: representative.totalInstallments,
            trackedFromInstallment: representative.trackedFromInstallment,
            trackedTransactionAmounts: allocatedRows.map((row) => row.amount),
            trackedAllocationAmounts: allocatedRows.map((row) => row.adminAmount as string),
          }),
        );
      }
    }

    return rows.flatMap((row) => {
      if (adminScope && row.adminAmount === null) return [];

      return [
        {
          id: row.id,
          seriesId: row.seriesId,
          name: row.name,
          note: row.note,
          amount: adminScope ? (row.adminAmount as string) : row.amount,
          purchaseDate: toDateString(row.purchaseDate),
          period: row.period,
          dueDate: row.dueDate ? toDateString(row.dueDate) : null,
          currentInstallment: row.currentInstallment as number,
          paymentMethod: row.paymentMethod as NonNullable<typeof row.paymentMethod>,
          isSettled: row.isSettled,
          invoicePaymentStatus: row.invoicePaymentStatus,
          totalInstallments: row.totalInstallments,
          trackedFromInstallment: row.trackedFromInstallment,
          originalAmount: adminScope
            ? (adminOriginalAmounts.get(row.seriesId) ?? row.originalAmount)
            : row.originalAmount,
          personId: adminScope ? row.adminPersonId : row.personId,
          personName: adminScope ? row.adminPersonName : row.personName,
          personAvatarUrl: adminScope ? row.adminPersonAvatarUrl : row.personAvatarUrl,
          categoryId: row.categoryId,
          categoryName: row.categoryName,
          categoryIcon: row.categoryIcon,
          cardId: row.cardId,
          cardName: row.cardName,
          cardLogo: row.cardLogo,
          cardDueDay: row.cardDueDay,
          accountId: row.transactionAccountId ?? row.cardAccountId,
          accountName: row.transactionAccountName ?? row.cardAccountName,
          accountLogo: row.transactionAccountLogo ?? row.cardAccountLogo,
        },
      ];
    });
  },

  async findByIdsForUser(ids, userId) {
    if (ids.length === 0) return [];

    const rows = await db
      .select({
        id: transactions.id,
        userId: transactions.userId,
        type: transactions.type,
        condition: transactions.condition,
        seriesId: transactions.seriesId,
        currentInstallment: transactions.currentInstallment,
        amount: transactions.amount,
        paymentMethod: transactions.paymentMethod,
        isSettled: transactions.isSettled,
        invoicePaymentStatus: invoices.paymentStatus,
        personId: transactions.personId,
        cardId: transactions.cardId,
        categoryId: transactions.categoryId,
        name: transactions.name,
        period: transactions.period,
      })
      .from(transactions)
      .leftJoin(
        invoices,
        and(
          eq(invoices.userId, userId),
          eq(invoices.cardId, transactions.cardId),
          eq(invoices.period, transactions.period),
        ),
      )
      .where(and(eq(transactions.userId, userId), inArray(transactions.id, ids)));

    const splitRows = await db
      .select({
        transactionId: transactionSplits.transactionId,
        personId: transactionSplits.personId,
        amount: transactionSplits.amount,
      })
      .from(transactionSplits)
      .where(
        and(eq(transactionSplits.userId, userId), inArray(transactionSplits.transactionId, ids)),
      );
    const splitsByTransaction = new Map<string, typeof splitRows>();
    for (const split of splitRows) {
      const current = splitsByTransaction.get(split.transactionId) ?? [];
      current.push(split);
      splitsByTransaction.set(split.transactionId, current);
    }

    return rows.flatMap((row) =>
      row.paymentMethod === null
        ? []
        : [
            {
              ...row,
              paymentMethod: row.paymentMethod,
              splitShares: (splitsByTransaction.get(row.id) ?? []).map((split) => ({
                personId: split.personId,
                amount: split.amount,
              })),
            },
          ],
    );
  },

  async createAnticipation(data) {
    return db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:${data.seriesId}`}, 0))`,
      );
      const selected = await transaction
        .select({
          id: transactions.id,
          period: transactions.period,
          cardId: transactions.cardId,
          seriesId: transactions.seriesId,
          condition: transactions.condition,
          paymentMethod: transactions.paymentMethod,
          type: transactions.type,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, data.userId),
            eq(transactions.seriesId, data.seriesId),
            inArray(transactions.id, data.installmentIds),
          ),
        )
        .for("update");
      const existingItems = await transaction
        .select({ id: installmentAnticipationItems.transactionId })
        .from(installmentAnticipationItems)
        .where(
          and(
            eq(installmentAnticipationItems.userId, data.userId),
            inArray(installmentAnticipationItems.transactionId, data.installmentIds),
          ),
        );
      const [targetInvoice] = await transaction
        .select({ paymentStatus: invoices.paymentStatus })
        .from(invoices)
        .where(
          and(
            eq(invoices.userId, data.userId),
            eq(invoices.cardId, data.cardId),
            eq(invoices.period, data.targetPeriod),
          ),
        );
      if (targetInvoice?.paymentStatus === "paid") {
        return { reason: "targetInvoicePaid" as const };
      }
      if (
        selected.length !== data.installmentIds.length ||
        existingItems.length > 0 ||
        selected.some(
          (item) =>
            item.seriesId !== data.seriesId ||
            item.cardId !== data.cardId ||
            item.condition !== "installment" ||
            item.paymentMethod !== "credit_card" ||
            item.type !== "expense" ||
            item.period <= data.targetPeriod,
        )
      ) {
        return null;
      }

      let adjustmentTransactionId: string | null = null;
      if (data.discount > 0) {
        const [adjustmentRecord] = await transaction
          .insert(transactions)
          .values({
            userId: data.userId,
            personId: data.personId,
            type: "income",
            origin: "invoiceAdjustment",
            condition: "single",
            paymentMethod: "credit_card",
            name: `Desconto por antecipação · ${data.name}`,
            amount: data.discount.toFixed(2),
            purchaseDate: new Date(),
            period: data.targetPeriod,
            accountId: null,
            cardId: data.cardId,
            categoryId: data.categoryId,
            sourceAccountId: null,
            destinationAccountId: null,
            dueDate: null,
            boletoPaymentDate: null,
            installmentCount: null,
            currentInstallment: null,
            seriesId: null,
            transferId: null,
            recurringRuleId: null,
            isSettled: null,
            note: "Desconto concedido na antecipação de parcelas.",
            importSourceFingerprint: null,
            importExternalId: null,
            importBatchId: null,
          })
          .returning({ id: transactions.id });
        const adjustment = adjustmentRecord as { id: string };
        adjustmentTransactionId = adjustment.id;
        if (data.discountAllocations.length > 1) {
          await transaction.insert(transactionSplits).values(
            data.discountAllocations.map((allocation) => ({
              userId: data.userId,
              transactionId: adjustment.id,
              personId: allocation.personId,
              amount: allocation.amount.toFixed(2),
            })),
          );
        }
      }

      const [anticipationRecord] = await transaction
        .insert(installmentAnticipations)
        .values({
          userId: data.userId,
          seriesId: data.seriesId,
          targetPeriod: data.targetPeriod,
          discount: data.discount.toFixed(2),
          adjustmentTransactionId,
        })
        .returning({ id: installmentAnticipations.id });
      const anticipation = anticipationRecord as { id: string };
      await transaction.insert(installmentAnticipationItems).values(
        selected.map((item) => ({
          anticipationId: anticipation.id,
          userId: data.userId,
          transactionId: item.id,
          originalPeriod: item.period,
        })),
      );
      await transaction
        .update(transactions)
        .set({ period: data.targetPeriod, updatedAt: new Date() })
        .where(
          and(eq(transactions.userId, data.userId), inArray(transactions.id, data.installmentIds)),
        );
      return anticipation;
    });
  },

  async findAnticipationForUser(userId, seriesId, anticipationId) {
    const [anticipation] = await db
      .select({
        id: installmentAnticipations.id,
        seriesId: installmentAnticipations.seriesId,
        targetPeriod: installmentAnticipations.targetPeriod,
        discount: installmentAnticipations.discount,
      })
      .from(installmentAnticipations)
      .where(
        and(
          eq(installmentAnticipations.id, anticipationId),
          eq(installmentAnticipations.seriesId, seriesId),
          eq(installmentAnticipations.userId, userId),
        ),
      );
    if (!anticipation) return null;

    const items = await db
      .select({
        id: transactions.id,
        amount: transactions.amount,
        personId: transactions.personId,
        installmentNumber: transactions.currentInstallment,
        totalInstallments: installmentSeries.totalInstallments,
        originalPeriod: installmentAnticipationItems.originalPeriod,
      })
      .from(installmentAnticipationItems)
      .innerJoin(
        transactions,
        and(
          eq(installmentAnticipationItems.transactionId, transactions.id),
          eq(transactions.userId, userId),
        ),
      )
      .innerJoin(
        installmentSeries,
        and(eq(transactions.seriesId, installmentSeries.id), eq(installmentSeries.userId, userId)),
      )
      .where(
        and(
          eq(installmentAnticipationItems.anticipationId, anticipationId),
          eq(installmentAnticipationItems.userId, userId),
        ),
      )
      .orderBy(asc(transactions.currentInstallment));
    if (items.length === 0) return null;

    const splits = await db
      .select({
        transactionId: transactionSplits.transactionId,
        personId: transactionSplits.personId,
        amount: transactionSplits.amount,
      })
      .from(transactionSplits)
      .where(
        and(
          eq(transactionSplits.userId, userId),
          inArray(
            transactionSplits.transactionId,
            items.map((item) => item.id),
          ),
        ),
      );

    return {
      ...anticipation,
      items: items.map((item) => ({
        id: item.id,
        amount: item.amount,
        personId: item.personId,
        installmentNumber: item.installmentNumber as number,
        totalInstallments: item.totalInstallments,
        originalPeriod: item.originalPeriod,
        splitShares: splits
          .filter((split) => split.transactionId === item.id)
          .map((split) => ({ personId: split.personId, amount: split.amount })),
      })),
    };
  },

  async undoAnticipation(data) {
    return db.transaction(async (transaction) => {
      await transaction.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:${data.seriesId}`}, 0))`,
      );
      const [anticipation] = await transaction
        .select({
          id: installmentAnticipations.id,
          targetPeriod: installmentAnticipations.targetPeriod,
          discount: installmentAnticipations.discount,
          adjustmentTransactionId: installmentAnticipations.adjustmentTransactionId,
        })
        .from(installmentAnticipations)
        .where(
          and(
            eq(installmentAnticipations.id, data.anticipationId),
            eq(installmentAnticipations.seriesId, data.seriesId),
            eq(installmentAnticipations.userId, data.userId),
          ),
        )
        .for("update");
      if (!anticipation) return null;
      const items = await transaction
        .select({
          transactionId: installmentAnticipationItems.transactionId,
          originalPeriod: installmentAnticipationItems.originalPeriod,
          cardId: transactions.cardId,
        })
        .from(installmentAnticipationItems)
        .innerJoin(
          transactions,
          and(
            eq(installmentAnticipationItems.transactionId, transactions.id),
            eq(transactions.userId, data.userId),
          ),
        )
        .where(
          and(
            eq(installmentAnticipationItems.anticipationId, data.anticipationId),
            eq(installmentAnticipationItems.userId, data.userId),
          ),
        );
      const selectedIds = new Set(data.installmentIds);
      const selectedItems = items.filter((item) => selectedIds.has(item.transactionId));
      const cardId = items[0]?.cardId;
      if (
        !cardId ||
        items.length !== data.expectedInstallmentCount ||
        selectedItems.length !== selectedIds.size ||
        Math.round(Number(anticipation.discount) * 100) !==
          Math.round(data.expectedDiscount * 100) ||
        items.some((item) => item.cardId !== cardId) ||
        (data.remainingDiscount > 0 &&
          (!anticipation.adjustmentTransactionId || data.remainingDiscountAllocations.length === 0))
      ) {
        return null;
      }
      const [payment] = await transaction
        .select({ id: invoicePayments.id })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, data.userId),
            eq(invoicePayments.cardId, cardId),
            eq(invoicePayments.period, anticipation.targetPeriod),
          ),
        )
        .limit(1);
      if (payment) return null;

      for (const item of selectedItems) {
        await transaction
          .update(transactions)
          .set({ period: item.originalPeriod, updatedAt: new Date() })
          .where(
            and(eq(transactions.id, item.transactionId), eq(transactions.userId, data.userId)),
          );
      }
      await transaction
        .delete(installmentAnticipationItems)
        .where(
          and(
            eq(installmentAnticipationItems.anticipationId, data.anticipationId),
            eq(installmentAnticipationItems.userId, data.userId),
            inArray(installmentAnticipationItems.transactionId, data.installmentIds),
          ),
        );

      const remainingInstallmentCount = items.length - selectedItems.length;
      if (remainingInstallmentCount === 0) {
        await transaction
          .delete(installmentAnticipations)
          .where(
            and(
              eq(installmentAnticipations.id, data.anticipationId),
              eq(installmentAnticipations.userId, data.userId),
            ),
          );
      } else {
        await transaction
          .update(installmentAnticipations)
          .set({ discount: data.remainingDiscount.toFixed(2) })
          .where(
            and(
              eq(installmentAnticipations.id, data.anticipationId),
              eq(installmentAnticipations.userId, data.userId),
            ),
          );
      }

      if (anticipation.adjustmentTransactionId && data.remainingDiscount === 0) {
        await transaction
          .delete(transactions)
          .where(
            and(
              eq(transactions.id, anticipation.adjustmentTransactionId),
              eq(transactions.userId, data.userId),
            ),
          );
      } else if (anticipation.adjustmentTransactionId && data.remainingDiscount > 0) {
        const singleAllocation =
          data.remainingDiscountAllocations.length === 1
            ? data.remainingDiscountAllocations[0]
            : null;
        await transaction
          .update(transactions)
          .set({
            amount: data.remainingDiscount.toFixed(2),
            ...(singleAllocation ? { personId: singleAllocation.personId } : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(transactions.id, anticipation.adjustmentTransactionId),
              eq(transactions.userId, data.userId),
            ),
          );
        await transaction
          .delete(transactionSplits)
          .where(
            and(
              eq(transactionSplits.transactionId, anticipation.adjustmentTransactionId),
              eq(transactionSplits.userId, data.userId),
            ),
          );
        if (data.remainingDiscountAllocations.length > 1) {
          await transaction.insert(transactionSplits).values(
            data.remainingDiscountAllocations.map((allocation) => ({
              userId: data.userId,
              transactionId: anticipation.adjustmentTransactionId as string,
              personId: allocation.personId,
              amount: allocation.amount.toFixed(2),
            })),
          );
        }
      }
      return { id: data.anticipationId };
    });
  },
} satisfies InstallmentsRepository;

function toDateString(value: Date) {
  return value.toISOString().slice(0, 10);
}
