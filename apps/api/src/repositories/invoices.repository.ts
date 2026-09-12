import {
  cards,
  categories,
  db,
  financialAccounts,
  invoicePaymentAllocations,
  invoicePayments,
  invoices,
  people,
  recurringTransactionRules,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
} from "@openmonetis/db";
import {
  invoiceAdjustmentCategoryName,
  invoicePaymentCategoryName,
} from "@openmonetis/domain/categories";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { InvoicesRepository } from "../services/invoices.service";

const transactionPeople = alias(people, "invoice_transaction_people");
const splitPeople = alias(people, "invoice_split_people");
const recurringPeople = alias(people, "invoice_recurring_people");
const recurringSplitPeople = alias(people, "invoice_recurring_split_people");

export const invoicesRepository = {
  listCards(userId) {
    return db
      .select({
        id: cards.id,
        accountId: cards.accountId,
        name: cards.name,
        logo: cards.logo,
        closingDay: cards.closingDay,
        closingRuleType: cards.closingRuleType,
        closingOffsetDays: cards.closingOffsetDays,
        closingOffsetMode: cards.closingOffsetMode,
        dueDay: cards.dueDay,
      })
      .from(cards)
      .where(eq(cards.userId, userId))
      .orderBy(asc(cards.name));
  },
  listAccounts(userId) {
    return db
      .select({
        id: financialAccounts.id,
        name: financialAccounts.name,
        logo: financialAccounts.logo,
      })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.userId, userId), eq(financialAccounts.isArchived, false)))
      .orderBy(asc(financialAccounts.name));
  },
  listMovements(userId, period) {
    return db
      .select({
        cardId: transactions.cardId,
        personId:
          sql<string>`case when ${transactionSplits.id} is not null then ${transactionSplits.personId} else ${transactions.personId} end`.as(
            "person_id",
          ),
        personName:
          sql<string>`case when ${transactionSplits.id} is not null then ${splitPeople.name} else ${transactionPeople.name} end`.as(
            "person_name",
          ),
        personAvatarUrl: sql<
          string | null
        >`case when ${transactionSplits.id} is not null then ${splitPeople.avatarUrl} else ${transactionPeople.avatarUrl} end`.as(
          "person_avatar_url",
        ),
        personRole: sql<
          "admin" | "external"
        >`case when ${transactionSplits.id} is not null then ${splitPeople.role} else ${transactionPeople.role} end`.as(
          "person_role",
        ),
        amount:
          sql<string>`case when ${transactionSplits.id} is not null then ${transactionSplits.amount} else ${transactions.amount} end`.as(
            "amount",
          ),
      })
      .from(transactions)
      .innerJoin(
        transactionPeople,
        and(eq(transactions.personId, transactionPeople.id), eq(transactionPeople.userId, userId)),
      )
      .leftJoin(
        transactionSplits,
        and(
          eq(transactionSplits.transactionId, transactions.id),
          eq(transactionSplits.userId, userId),
        ),
      )
      .leftJoin(
        splitPeople,
        and(eq(transactionSplits.personId, splitPeople.id), eq(splitPeople.userId, userId)),
      )
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.period, period),
          isNotNull(transactions.cardId),
          or(isNull(transactionSplits.id), isNotNull(splitPeople.id)),
        ),
      );
  },
  async listRecurringMovements(userId, periodEnd) {
    const rows = await db
      .select({
        cardId: recurringTransactionRules.cardId,
        personId:
          sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringTransactionSplits.personId} else ${recurringTransactionRules.personId} end`.as(
            "person_id",
          ),
        personName:
          sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringSplitPeople.name} else ${recurringPeople.name} end`.as(
            "person_name",
          ),
        personAvatarUrl: sql<
          string | null
        >`case when ${recurringTransactionSplits.id} is not null then ${recurringSplitPeople.avatarUrl} else ${recurringPeople.avatarUrl} end`.as(
          "person_avatar_url",
        ),
        personRole: sql<
          "admin" | "external"
        >`case when ${recurringTransactionSplits.id} is not null then ${recurringSplitPeople.role} else ${recurringPeople.role} end`.as(
          "person_role",
        ),
        amount:
          sql<string>`case when ${recurringTransactionSplits.id} is not null then ${recurringTransactionSplits.amount} else ${recurringTransactionRules.amount} end`.as(
            "amount",
          ),
        startDate: recurringTransactionRules.startDate,
        endDate: recurringTransactionRules.endDate,
        frequency: recurringTransactionRules.frequency,
        paymentMethod: recurringTransactionRules.paymentMethod,
        dueDate: recurringTransactionRules.dueDate,
        closingDay: cards.closingDay,
        closingRuleType: cards.closingRuleType,
        closingOffsetDays: cards.closingOffsetDays,
        closingOffsetMode: cards.closingOffsetMode,
        dueDay: cards.dueDay,
      })
      .from(recurringTransactionRules)
      .innerJoin(
        cards,
        and(eq(recurringTransactionRules.cardId, cards.id), eq(cards.userId, userId)),
      )
      .innerJoin(
        recurringPeople,
        and(
          eq(recurringTransactionRules.personId, recurringPeople.id),
          eq(recurringPeople.userId, userId),
        ),
      )
      .leftJoin(
        recurringTransactionSplits,
        and(
          eq(recurringTransactionSplits.recurringRuleId, recurringTransactionRules.id),
          eq(recurringTransactionSplits.userId, userId),
        ),
      )
      .leftJoin(
        recurringSplitPeople,
        and(
          eq(recurringTransactionSplits.personId, recurringSplitPeople.id),
          eq(recurringSplitPeople.userId, userId),
        ),
      )
      .where(
        and(
          eq(recurringTransactionRules.userId, userId),
          eq(recurringTransactionRules.status, "active"),
          lte(recurringTransactionRules.startDate, periodEnd),
          or(isNull(recurringTransactionSplits.id), isNotNull(recurringSplitPeople.id)),
        ),
      );
    return rows.map((row) => ({
      ...row,
      startDate: row.startDate.toISOString().slice(0, 10),
      endDate: row.endDate?.toISOString().slice(0, 10) ?? null,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
    }));
  },
  listPaymentAllocations(userId, period) {
    return db
      .select({
        cardId: invoicePayments.cardId,
        personId: invoicePaymentAllocations.personId,
        amount: invoicePaymentAllocations.amount,
      })
      .from(invoicePaymentAllocations)
      .innerJoin(
        invoicePayments,
        and(
          eq(invoicePaymentAllocations.paymentId, invoicePayments.id),
          eq(invoicePayments.userId, userId),
        ),
      )
      .where(and(eq(invoicePaymentAllocations.userId, userId), eq(invoicePayments.period, period)));
  },
  async listPayments(userId, period) {
    const rows = await db
      .select({
        id: invoicePayments.id,
        cardId: invoicePayments.cardId,
        amount: invoicePayments.amount,
        paidAt: invoicePayments.paidAt,
      })
      .from(invoicePayments)
      .where(and(eq(invoicePayments.userId, userId), eq(invoicePayments.period, period)))
      .orderBy(desc(invoicePayments.createdAt));
    return rows.map((row) => ({
      ...row,
      paidAt: row.paidAt.toISOString().slice(0, 10),
    }));
  },
  async listDates(userId, period) {
    const rows = await db
      .select({
        cardId: invoices.cardId,
        closingDate: invoices.closingDate,
        dueDate: invoices.dueDate,
        datesCustomized: invoices.datesCustomized,
      })
      .from(invoices)
      .where(and(eq(invoices.userId, userId), eq(invoices.period, period)));
    return rows.map((row) => ({
      cardId: row.cardId,
      closingDate: row.closingDate?.toISOString().slice(0, 10) ?? null,
      dueDate: row.dueDate?.toISOString().slice(0, 10) ?? null,
      datesCustomized: row.datesCustomized,
    }));
  },
  async findOwnedContext(userId, cardId, accountId, personIds) {
    const accountRequest = accountId
      ? db
          .select({ id: financialAccounts.id, name: financialAccounts.name })
          .from(financialAccounts)
          .where(
            and(
              eq(financialAccounts.userId, userId),
              eq(financialAccounts.id, accountId),
              eq(financialAccounts.isArchived, false),
            ),
          )
      : Promise.resolve([]);
    const [cardRows, accountRows, personRows, adminRows, paymentCategoryRows] = await Promise.all([
      db
        .select({ id: cards.id, name: cards.name })
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.id, cardId))),
      accountRequest,
      db
        .select({ id: people.id, name: people.name })
        .from(people)
        .where(and(eq(people.userId, userId), inArray(people.id, personIds))),
      db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.userId, userId), eq(people.role, "admin"))),
      db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.name, invoicePaymentCategoryName),
            eq(categories.type, "expense"),
          ),
        )
        .limit(1),
    ]);
    return {
      card: cardRows[0] ?? null,
      account: accountRows[0] ?? null,
      people: personRows,
      adminPersonId: adminRows[0]?.id ?? null,
      paymentCategoryId: paymentCategoryRows[0]?.id ?? null,
    };
  },
  async insertPayment(data) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:${data.cardId}:${data.period}`}, 0))`,
      );
      const [current] = await tx
        .select({ total: sql<string>`coalesce(sum(${invoicePayments.amount}), 0)` })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, data.userId),
            eq(invoicePayments.cardId, data.cardId),
            eq(invoicePayments.period, data.period),
          ),
        );
      if (Number((current as { total: string }).total) !== data.expectedPaidAmount) return null;
      let transactionId: string | null = null;
      if (data.adminAmount > 0 && data.accountId && data.paymentCategoryId) {
        const [movementRecord] = await tx
          .insert(transactions)
          .values({
            userId: data.userId,
            personId: data.adminPersonId,
            type: "expense",
            origin: "invoicePayment",
            condition: "single",
            paymentMethod: "bank_transfer",
            name: `Pagamento fatura ${data.cardName}`,
            amount: (-data.adminAmount).toFixed(2),
            purchaseDate: new Date(`${data.paidAt}T00:00:00.000Z`),
            period: data.paidAt.slice(0, 7),
            accountId: data.accountId,
            cardId: null,
            categoryId: data.paymentCategoryId,
            sourceAccountId: null,
            destinationAccountId: null,
            dueDate: null,
            boletoPaymentDate: null,
            installmentCount: null,
            currentInstallment: null,
            seriesId: null,
            transferId: null,
            recurringRuleId: null,
            isSettled: true,
            note: data.note,
            importSourceFingerprint: null,
            importExternalId: null,
            importBatchId: null,
          })
          .returning({ id: transactions.id });
        transactionId = (movementRecord as { id: string }).id;
      }
      const [paymentRecord] = await tx
        .insert(invoicePayments)
        .values({
          userId: data.userId,
          cardId: data.cardId,
          period: data.period,
          accountId: data.accountId,
          transactionId,
          amount: data.amount.toFixed(2),
          paidAt: new Date(`${data.paidAt}T00:00:00.000Z`),
        })
        .returning({ id: invoicePayments.id });
      const payment = paymentRecord as { id: string };
      await tx.insert(invoicePaymentAllocations).values(
        data.allocations.map((item) => ({
          userId: data.userId,
          paymentId: payment.id,
          personId: item.personId,
          amount: item.amount.toFixed(2),
        })),
      );
      const [previousAccount] =
        data.remainingAmount === 0 && data.accountId === null
          ? await tx
              .select({ accountId: invoicePayments.accountId })
              .from(invoicePayments)
              .where(
                and(
                  eq(invoicePayments.userId, data.userId),
                  eq(invoicePayments.cardId, data.cardId),
                  eq(invoicePayments.period, data.period),
                  isNotNull(invoicePayments.accountId),
                ),
              )
              .orderBy(desc(invoicePayments.createdAt))
              .limit(1)
          : [];
      const paymentAccountId = data.accountId ?? previousAccount?.accountId ?? null;
      await tx
        .insert(invoices)
        .values({
          userId: data.userId,
          cardId: data.cardId,
          period: data.period,
          paymentStatus: data.remainingAmount === 0 ? "paid" : "pending",
          paidAt: data.remainingAmount === 0 ? new Date(`${data.paidAt}T00:00:00.000Z`) : null,
          paymentAccountId: data.remainingAmount === 0 ? paymentAccountId : null,
          closingDate: new Date(`${data.closingDate}T00:00:00.000Z`),
          dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
        })
        .onConflictDoUpdate({
          target: [invoices.userId, invoices.cardId, invoices.period],
          set: {
            paymentStatus: data.remainingAmount === 0 ? "paid" : "pending",
            paidAt: data.remainingAmount === 0 ? new Date(`${data.paidAt}T00:00:00.000Z`) : null,
            paymentAccountId: data.remainingAmount === 0 ? paymentAccountId : null,
            closingDate: new Date(`${data.closingDate}T00:00:00.000Z`),
            dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
            updatedAt: new Date(),
          },
        });
      return { id: payment.id };
    });
  },
  async deletePayment(userId, cardId, period, paymentId) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${cardId}:${period}`}, 0))`,
      );
      const [payment] = await tx
        .select({
          id: invoicePayments.id,
          amount: invoicePayments.amount,
          transactionId: invoicePayments.transactionId,
        })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.id, paymentId),
            eq(invoicePayments.userId, userId),
            eq(invoicePayments.cardId, cardId),
            eq(invoicePayments.period, period),
          ),
        )
        .limit(1);
      if (!payment) return null;
      await tx
        .delete(invoicePayments)
        .where(and(eq(invoicePayments.id, payment.id), eq(invoicePayments.userId, userId)));
      if (payment.transactionId) {
        await tx
          .delete(transactions)
          .where(and(eq(transactions.id, payment.transactionId), eq(transactions.userId, userId)));
      }
      await tx
        .update(invoices)
        .set({
          paymentStatus: "pending",
          paidAt: null,
          paymentAccountId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.cardId, cardId),
            eq(invoices.period, period),
          ),
        );
      return { id: payment.id, amount: payment.amount };
    });
  },
  async findAdjustmentContext(userId, cardId, personId) {
    const categoryName = invoiceAdjustmentCategoryName;
    const [cardRows, personRows, categoryRows] = await Promise.all([
      db
        .select({ id: cards.id, name: cards.name })
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.id, cardId)))
        .limit(1),
      db
        .select({ id: people.id })
        .from(people)
        .where(and(eq(people.userId, userId), eq(people.id, personId), eq(people.status, "active")))
        .limit(1),
      db
        .select({ id: categories.id })
        .from(categories)
        .where(
          and(
            eq(categories.userId, userId),
            eq(categories.name, categoryName),
            eq(categories.type, "expense"),
            eq(categories.isSystem, true),
          ),
        )
        .limit(1),
    ]);
    return {
      card: cardRows[0] ?? null,
      personId: personRows[0]?.id ?? null,
      categoryId: categoryRows[0]?.id ?? null,
    };
  },
  async insertAdjustment(data) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${data.userId}:${data.cardId}:${data.period}`}, 0))`,
      );
      const [payment] = await tx
        .select({ id: invoicePayments.id })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, data.userId),
            eq(invoicePayments.cardId, data.cardId),
            eq(invoicePayments.period, data.period),
          ),
        )
        .limit(1);
      if (payment) return null;
      const [adjustmentRecord] = await tx
        .insert(transactions)
        .values({
          userId: data.userId,
          personId: data.personId,
          type: data.type,
          origin: "invoiceAdjustment",
          condition: "single",
          paymentMethod: "credit_card",
          name: `Ajuste de fatura - ${data.cardName}`,
          amount: data.amount,
          purchaseDate: new Date(`${data.date}T00:00:00.000Z`),
          period: data.period,
          accountId: null,
          cardId: data.cardId,
          categoryId: data.categoryId,
          isSettled: null,
          note: data.note,
        })
        .returning({ id: transactions.id });
      const adjustment = adjustmentRecord as { id: string };
      return adjustment;
    });
  },
  async reopenInvoice(userId, cardId, period) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${cardId}:${period}`}, 0))`,
      );
      const [ownedCard] = await tx
        .select({ id: cards.id })
        .from(cards)
        .where(and(eq(cards.userId, userId), eq(cards.id, cardId)))
        .limit(1);
      if (!ownedCard) return null;

      const payments = await tx
        .select({
          id: invoicePayments.id,
          amount: invoicePayments.amount,
          transactionId: invoicePayments.transactionId,
        })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, userId),
            eq(invoicePayments.cardId, cardId),
            eq(invoicePayments.period, period),
          ),
        );

      if (payments.length) {
        await tx.delete(invoicePayments).where(
          and(
            eq(invoicePayments.userId, userId),
            inArray(
              invoicePayments.id,
              payments.map((payment) => payment.id),
            ),
          ),
        );
        const transactionIds = payments.flatMap((payment) =>
          payment.transactionId ? [payment.transactionId] : [],
        );
        if (transactionIds.length) {
          await tx
            .delete(transactions)
            .where(and(eq(transactions.userId, userId), inArray(transactions.id, transactionIds)));
        }
      }

      await tx
        .update(invoices)
        .set({
          paymentStatus: "pending",
          paidAt: null,
          paymentAccountId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(invoices.userId, userId),
            eq(invoices.cardId, cardId),
            eq(invoices.period, period),
          ),
        );

      return {
        reversedPaymentCount: payments.length,
        reversedAmount:
          payments.reduce((total, payment) => total + Math.round(Number(payment.amount) * 100), 0) /
          100,
      };
    });
  },
  async deleteAdjustment(userId, cardId, period, adjustmentId) {
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${userId}:${cardId}:${period}`}, 0))`,
      );
      const [payment] = await tx
        .select({ id: invoicePayments.id })
        .from(invoicePayments)
        .where(
          and(
            eq(invoicePayments.userId, userId),
            eq(invoicePayments.cardId, cardId),
            eq(invoicePayments.period, period),
          ),
        )
        .limit(1);
      if (payment) return "has_payments" as const;

      const [deleted] = await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.id, adjustmentId),
            eq(transactions.userId, userId),
            eq(transactions.cardId, cardId),
            eq(transactions.period, period),
            eq(transactions.origin, "invoiceAdjustment"),
          ),
        )
        .returning({ id: transactions.id });
      return deleted ? ("deleted" as const) : ("not_found" as const);
    });
  },
  async upsertDates(data) {
    const [ownedCard] = await db
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.id, data.cardId), eq(cards.userId, data.userId)))
      .limit(1);
    if (!ownedCard) return false;
    await db
      .insert(invoices)
      .values({
        userId: data.userId,
        cardId: data.cardId,
        period: data.period,
        closingDate: new Date(`${data.closingDate}T00:00:00.000Z`),
        dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
        datesCustomized: true,
      })
      .onConflictDoUpdate({
        target: [invoices.userId, invoices.cardId, invoices.period],
        set: {
          closingDate: new Date(`${data.closingDate}T00:00:00.000Z`),
          dueDate: new Date(`${data.dueDate}T00:00:00.000Z`),
          datesCustomized: true,
          updatedAt: new Date(),
        },
      });
    return true;
  },
} satisfies InvoicesRepository;
