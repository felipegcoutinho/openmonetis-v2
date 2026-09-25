#!/usr/bin/env tsx

import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  budgets,
  cards,
  categories,
  db,
  financialAccounts,
  inboxItems,
  installmentSeries,
  invoicePaymentAllocations,
  invoicePayments,
  invoices,
  type NewRecurringTransactionRule,
  type NewTransaction,
  noteItems,
  notes,
  people,
  pool,
  recurringTransactionOccurrences,
  recurringTransactionRules,
  recurringTransactionSeries,
  recurringTransactionSplits,
  transactionSplits,
  transactions,
  user,
} from "@openmonetis/db";
import { getInvoiceDates } from "@openmonetis/domain/cards";
import {
  createDefaultCategoryDrafts,
  invoicePaymentCategoryName,
} from "@openmonetis/domain/categories";
import { defaultAdminPersonAvatarUrl } from "@openmonetis/domain/people";
import {
  addMonthsToPeriod,
  buildTrackedInstallmentSchedule,
  deriveTransactionPeriod,
  listRecurrenceDatesInPeriod,
  normalizeTransactionAmount,
  type PaymentMethod,
  type TransactionType,
} from "@openmonetis/domain/transactions";
import { and, eq, inArray, ne } from "drizzle-orm";

const DEFAULT_MONTHS = 6;
const MIN_MONTHS = 3;
const MAX_MONTHS = 24;

export type CliOptions = {
  userId: string | null;
  email: string | null;
  startPeriod: string;
  months: number;
};

type SeedSummary = {
  people: number;
  accounts: number;
  cards: number;
  notes: number;
  budgets: number;
  recurringRules: number;
  installmentSeries: number;
  transactions: number;
  invoices: number;
  invoicePayments: number;
  inboxItems: number;
};

type SeedCard = {
  id: string;
  accountId: string;
  name: string;
  closingDay: number;
  dueDay: number;
};

type SingleTransactionInput = {
  name: string;
  amount: number;
  type: Exclude<TransactionType, "transfer">;
  paymentMethod: PaymentMethod;
  purchaseDate: string;
  personId: string;
  categoryId: string;
  accountId?: string;
  card?: SeedCard;
  dueDate?: string;
  note?: string;
  settlement?: "auto" | "open" | "settled";
  splitShares?: Array<{ personId: string; amount: number }>;
};

type RecurringDefinition = {
  id: string;
  name: string;
  amount: number;
  type: Exclude<TransactionType, "transfer">;
  paymentMethod: PaymentMethod;
  startDate: string;
  dueDate?: string;
  personId: string;
  categoryId: string;
  accountId?: string;
  cardId?: string;
  note: string;
  splitShares?: Array<{ personId: string; amount: number }>;
};

export function printUsage() {
  console.log(`
Uso:
  pnpm db:seed -- --email=<email> --startPeriod=YYYY-MM [--months=${DEFAULT_MONTHS}]
  pnpm db:seed -- --userId=<uuid> --startPeriod=YYYY-MM [--months=${DEFAULT_MONTHS}]

Exemplos:
  pnpm db:seed -- --email=demo@openmonetis.local --startPeriod=2026-02
  pnpm db:seed -- --userId=3f6d2b84-6ed0-4a50-b257-8adf0b6178de --startPeriod=2026-01 --months=8

O usuário precisa existir e não pode ter dados financeiros. Categorias padrão e a pessoa
administradora criadas no cadastro não impedem a execução.
`);
}

export function parseArgs(argv: string[]): CliOptions | null {
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return null;
  }

  let userId: string | null = null;
  let email: string | null = null;
  let startPeriod = "";
  let months = DEFAULT_MONTHS;

  for (const argument of argv) {
    if (argument.startsWith("--userId=") || argument.startsWith("--user-id=")) {
      userId = (argument.split("=")[1] as string).trim() || null;
      continue;
    }
    if (argument.startsWith("--email=")) {
      email = (argument.split("=")[1] as string).trim().toLowerCase() || null;
      continue;
    }
    if (argument.startsWith("--startPeriod=") || argument.startsWith("--start-period=")) {
      startPeriod = (argument.split("=")[1] as string).trim();
      continue;
    }
    if (argument.startsWith("--months=")) {
      months = Number(argument.split("=")[1] as string);
    }
  }

  if (Boolean(userId) === Boolean(email)) {
    throw new Error("Informe exatamente um alvo: `--email` ou `--userId`.");
  }
  if (!/^[1-9]\d{3}-(0[1-9]|1[0-2])$/.test(startPeriod)) {
    throw new Error("Informe `--startPeriod` no formato `YYYY-MM`.");
  }
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) {
    throw new Error(`O parâmetro \`--months\` deve ficar entre ${MIN_MONTHS} e ${MAX_MONTHS}.`);
  }

  return { userId, email, startPeriod, months };
}

export function toDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

export function dateForPeriodDay(period: string, requestedDay: number) {
  const [year, month] = period.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(Math.max(1, requestedDay), lastDay);
  return `${period}-${String(day).padStart(2, "0")}`;
}

export function getTodayInBrazil() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

export function fingerprint(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function createSingleTransaction(
  input: SingleTransactionInput,
  userId: string,
  today: string,
) {
  const id = randomUUID();
  const period = deriveTransactionPeriod({
    paymentMethod: input.paymentMethod,
    purchaseDate: input.purchaseDate,
    dueDate: input.dueDate,
    card: input.card
      ? {
          closingDay: input.card.closingDay,
          closingRule: { type: "fixedDay", closingDay: input.card.closingDay },
          dueDay: input.card.dueDay,
        }
      : null,
  });
  const automaticallySettled = (input.dueDate ?? input.purchaseDate) <= today;
  const isSettled =
    input.paymentMethod === "credit_card"
      ? null
      : input.settlement === "settled"
        ? true
        : input.settlement === "open"
          ? false
          : automaticallySettled;

  const transaction: NewTransaction = {
    id,
    userId,
    personId: input.personId,
    type: input.type,
    origin: "regular",
    condition: "single",
    paymentMethod: input.paymentMethod,
    name: input.name,
    amount: normalizeTransactionAmount(input.type, input.amount).toFixed(2),
    purchaseDate: toDate(input.purchaseDate),
    period,
    accountId: input.accountId ?? null,
    cardId: input.card?.id ?? null,
    categoryId: input.categoryId,
    sourceAccountId: null,
    destinationAccountId: null,
    dueDate: input.dueDate ? toDate(input.dueDate) : null,
    boletoPaymentDate:
      input.paymentMethod === "boleto" && isSettled
        ? toDate(input.dueDate ?? input.purchaseDate)
        : null,
    installmentCount: null,
    currentInstallment: null,
    seriesId: null,
    transferId: null,
    recurringRuleId: null,
    isSettled,
    note: input.note ?? null,
  };

  const splits = (input.splitShares ?? []).map((share) => ({
    id: randomUUID(),
    userId,
    transactionId: id,
    personId: share.personId,
    amount: normalizeTransactionAmount(input.type, share.amount).toFixed(2),
  }));

  return { transaction, splits };
}

export async function resolveTargetUser(options: CliOptions) {
  const [targetUser] = options.userId
    ? await db.select().from(user).where(eq(user.id, options.userId)).limit(1)
    : await db
        .select()
        .from(user)
        .where(eq(user.email, options.email as string))
        .limit(1);

  if (!targetUser) {
    throw new Error(
      options.userId
        ? `Usuário ${options.userId} não foi encontrado.`
        : `Usuário com e-mail ${options.email} não foi encontrado.`,
    );
  }
  return targetUser;
}

export async function assertFinancialSpaceIsEmpty(userId: string) {
  const counts = await Promise.all([
    db.$count(financialAccounts, eq(financialAccounts.userId, userId)),
    db.$count(cards, eq(cards.userId, userId)),
    db.$count(transactions, eq(transactions.userId, userId)),
    db.$count(recurringTransactionRules, eq(recurringTransactionRules.userId, userId)),
    db.$count(installmentSeries, eq(installmentSeries.userId, userId)),
    db.$count(invoices, eq(invoices.userId, userId)),
    db.$count(budgets, eq(budgets.userId, userId)),
    db.$count(notes, eq(notes.userId, userId)),
    db.$count(inboxItems, eq(inboxItems.userId, userId)),
    db.$count(people, and(eq(people.userId, userId), ne(people.role, "admin"))),
  ]);
  const labels = [
    "conta(s)",
    "cartão(ões)",
    "lançamento(s)",
    "regra(s) recorrente(s)",
    "série(s) parcelada(s)",
    "fatura(s)",
    "orçamento(s)",
    "anotação(ões)",
    "item(ns) da caixa de entrada",
    "pessoa(s) externa(s)",
  ];
  const blockers = counts.flatMap((count, index) =>
    count > 0 ? [`${count} ${labels[index]}`] : [],
  );

  if (blockers.length) {
    throw new Error(
      `A conta do usuário precisa estar financeiramente vazia. Encontrado: ${blockers.join(", ")}.`,
    );
  }
}

export async function seedMockData(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (!options) return;

  const targetUser = await resolveTargetUser(options);
  await assertFinancialSpaceIsEmpty(targetUser.id);

  const today = getTodayInBrazil();
  const periods = Array.from({ length: options.months }, (_, index) =>
    addMonthsToPeriod(options.startPeriod, index),
  );
  const firstPeriod = periods[0] as string;
  const secondPeriod = periods[1] as string;
  const thirdPeriod = periods[2] as string;
  const middlePeriod = periods[Math.floor(periods.length / 2)] as string;
  const lastPeriod = periods.at(-1) as string;
  const summary: SeedSummary = {
    people: 0,
    accounts: 0,
    cards: 0,
    notes: 0,
    budgets: 0,
    recurringRules: 0,
    installmentSeries: 0,
    transactions: 0,
    invoices: 0,
    invoicePayments: 0,
    inboxItems: 0,
  };

  const seededPeriods = new Set<string>();

  await db.transaction(async (tx) => {
    await tx
      .insert(categories)
      .values(createDefaultCategoryDrafts(targetUser.id))
      .onConflictDoNothing();

    const categoryRows = await tx
      .select({ id: categories.id, name: categories.name, type: categories.type })
      .from(categories)
      .where(eq(categories.userId, targetUser.id));
    const categoriesByKey = new Map(
      categoryRows.map((category) => [`${category.type}:${category.name}`, category.id]),
    );
    const categoryId = (type: "income" | "expense", name: string) => {
      const id = categoriesByKey.get(`${type}:${name}`);
      if (!id) throw new Error(`Categoria obrigatória não encontrada: ${type}/${name}.`);
      return id;
    };

    let [adminPerson] = await tx
      .select()
      .from(people)
      .where(and(eq(people.userId, targetUser.id), eq(people.role, "admin")))
      .limit(1);
    if (!adminPerson) {
      [adminPerson] = await tx
        .insert(people)
        .values({
          id: randomUUID(),
          userId: targetUser.id,
          name: targetUser.name,
          email: targetUser.email,
          avatarUrl: defaultAdminPersonAvatarUrl,
          providerAvatarUrl: targetUser.image,
          role: "admin",
          status: "active",
          note: "Pessoa administradora da conta.",
        })
        .returning();
    }
    if (!adminPerson) throw new Error("Não foi possível localizar a pessoa administradora.");

    const marinaId = randomUUID();
    const eduardoId = randomUUID();
    await tx.insert(people).values([
      {
        id: marinaId,
        userId: targetUser.id,
        name: "Marina Oliveira",
        email: "marina.oliveira@exemplo.com",
        avatarUrl: "/avatars/4825038.png",
        role: "external",
        status: "active",
        note: "Divide despesas da casa e do mercado.",
      },
      {
        id: eduardoId,
        userId: targetUser.id,
        name: "Eduardo Lima",
        email: "eduardo.lima@exemplo.com",
        avatarUrl: "/avatars/4825108.png",
        role: "external",
        status: "active",
        note: "Costuma dividir viagens e presentes em família.",
      },
    ]);
    summary.people += 2;

    const accountIds = {
      nubank: randomUUID(),
      itau: randomUUID(),
      mercadoPago: randomUUID(),
    };
    await tx.insert(financialAccounts).values([
      {
        id: accountIds.nubank,
        userId: targetUser.id,
        name: "Nubank",
        type: "checking",
        logo: "/logos/nubank.png",
        note: "Conta principal para salário e despesas do dia a dia.",
        excludeFromBalance: false,
      },
      {
        id: accountIds.itau,
        userId: targetUser.id,
        name: "Itaú Personnalité",
        type: "checking",
        logo: "/logos/itaupersonnalite.png",
        note: "Conta para boletos, investimentos e pagamentos maiores.",
        excludeFromBalance: false,
      },
      {
        id: accountIds.mercadoPago,
        userId: targetUser.id,
        name: "Mercado Pago",
        type: "cash",
        logo: "/logos/mercadopago.png",
        note: "Carteira para corridas e pequenos gastos.",
        excludeFromBalance: false,
      },
    ]);
    summary.accounts += 3;

    const cardRows: Record<"ultravioleta" | "itaucard", SeedCard> = {
      ultravioleta: {
        id: randomUUID(),
        accountId: accountIds.nubank,
        name: "Nubank Ultravioleta",
        closingDay: 25,
        dueDay: 3,
      },
      itaucard: {
        id: randomUUID(),
        accountId: accountIds.itau,
        name: "Pão de Açúcar Itaucard",
        closingDay: 15,
        dueDay: 22,
      },
    };
    await tx.insert(cards).values([
      {
        ...cardRows.ultravioleta,
        userId: targetUser.id,
        brand: "mastercard",
        status: "active",
        closingRuleType: "fixedDay",
        closingOffsetDays: null,
        closingOffsetMode: null,
        limit: "12000.00",
        logo: "/logos/nubank-ultravioleta.png",
        note: "Cartão principal para assinaturas, delivery e compras parceladas.",
      },
      {
        ...cardRows.itaucard,
        userId: targetUser.id,
        brand: "visa",
        status: "active",
        closingRuleType: "fixedDay",
        closingOffsetDays: null,
        closingOffsetMode: null,
        limit: "10000.00",
        logo: "/logos/pao-acucar.png",
        note: "Cartão para mercado, compras maiores e viagens.",
      },
    ]);
    summary.cards += 2;

    const planningNoteId = randomUUID();
    const checklistNoteId = randomUUID();
    const insuranceNoteId = randomUUID();
    await tx.insert(notes).values([
      {
        id: planningNoteId,
        userId: targetUser.id,
        title: "Planejar viagem de julho",
        kind: "text",
        content:
          "Separar hospedagem, passagens e gastos previstos da viagem. Meta: manter tudo abaixo de R$ 4.500.",
      },
      {
        id: checklistNoteId,
        userId: targetUser.id,
        title: "Pendências do apartamento",
        kind: "checklist",
        content: null,
      },
      {
        id: insuranceNoteId,
        userId: targetUser.id,
        title: "Renegociar seguro do carro",
        kind: "text",
        content:
          "Pesquisar novas propostas antes do vencimento, priorizando franquia menor e assistência 24h.",
      },
    ]);
    await tx.insert(noteItems).values([
      {
        id: randomUUID(),
        userId: targetUser.id,
        noteId: checklistNoteId,
        text: "Revisar reajuste do aluguel",
        isCompleted: true,
        position: 0,
      },
      {
        id: randomUUID(),
        userId: targetUser.id,
        noteId: checklistNoteId,
        text: "Separar comprovantes do condomínio",
        isCompleted: false,
        position: 1,
      },
      {
        id: randomUUID(),
        userId: targetUser.id,
        noteId: checklistNoteId,
        text: "Confirmar vistoria do ar-condicionado",
        isCompleted: false,
        position: 2,
      },
    ]);
    summary.notes += 3;

    const budgetDefinitions = [
      { category: "Mercado", amount: 1500 },
      { category: "Restaurantes", amount: 480 },
      { category: "Transporte", amount: 620 },
      { category: "Moradia", amount: 3200 },
      { category: "Lazer", amount: 420 },
      { category: "Assinaturas", amount: 240 },
    ] as const;
    const budgetRows = periods.flatMap((period, index) =>
      budgetDefinitions.map((definition) => ({
        id: randomUUID(),
        userId: targetUser.id,
        categoryId: categoryId("expense", definition.category),
        period,
        amount: (definition.amount + index * 15).toFixed(2),
      })),
    );
    await tx.insert(budgets).values(budgetRows);
    summary.budgets += budgetRows.length;

    const transactionRows: NewTransaction[] = [];
    const splitRows: Array<typeof transactionSplits.$inferInsert> = [];
    const appendSingle = (input: SingleTransactionInput) => {
      const created = createSingleTransaction(input, targetUser.id, today);
      transactionRows.push(created.transaction);
      splitRows.push(...created.splits);
      seededPeriods.add(created.transaction.period);
    };

    const initialBalances = [
      { accountId: accountIds.nubank, name: "Nubank", amount: 4200 },
      { accountId: accountIds.itau, name: "Itaú Personnalité", amount: 1850 },
      { accountId: accountIds.mercadoPago, name: "Mercado Pago", amount: 350 },
    ];
    for (const balance of initialBalances) {
      transactionRows.push({
        id: randomUUID(),
        userId: targetUser.id,
        personId: adminPerson.id,
        type: "income",
        origin: "accountBalanceAdjustment",
        condition: "single",
        paymentMethod: null,
        name: `Ajuste de saldo - ${balance.name}`,
        amount: balance.amount.toFixed(2),
        purchaseDate: toDate(dateForPeriodDay(firstPeriod, 1)),
        period: firstPeriod,
        accountId: balance.accountId,
        categoryId: categoryId("income", "Ajuste de saldo"),
        isSettled: true,
        note: "Saldo inicial criado pelo seed de demonstração.",
      });
      seededPeriods.add(firstPeriod);
    }

    for (const [index, period] of periods.entries()) {
      const marketAmount = 420 + index * 37.5;
      appendSingle({
        name: "Assaí Atacadista",
        amount: marketAmount,
        type: "expense",
        paymentMethod: "pix",
        purchaseDate: dateForPeriodDay(period, 6),
        accountId: accountIds.nubank,
        categoryId: categoryId("expense", "Mercado"),
        personId: adminPerson.id,
        note: "Compra do mês dividida com Marina.",
        splitShares: [
          { personId: adminPerson.id, amount: marketAmount / 2 },
          { personId: marinaId, amount: marketAmount / 2 },
        ],
      });
      appendSingle({
        name: "Uber",
        amount: 32 + index * 4.75,
        type: "expense",
        paymentMethod: "pix",
        purchaseDate: dateForPeriodDay(period, 14),
        accountId: accountIds.mercadoPago,
        categoryId: categoryId("expense", "Transporte"),
        personId: adminPerson.id,
        note: "Corridas do dia a dia.",
      });
      appendSingle({
        name: "Posto Shell",
        amount: 170 + index * 18.2,
        type: "expense",
        paymentMethod: "debit_card",
        purchaseDate: dateForPeriodDay(period, 18),
        accountId: accountIds.itau,
        categoryId: categoryId("expense", "Transporte"),
        personId: adminPerson.id,
        note: "Abastecimento mensal.",
      });
      appendSingle({
        name: "iFood",
        amount: 62 + index * 7.3,
        type: "expense",
        paymentMethod: "credit_card",
        purchaseDate: dateForPeriodDay(period, 20),
        card: cardRows.ultravioleta,
        categoryId: categoryId("expense", "Delivery"),
        personId: adminPerson.id,
        note: "Pedidos de jantar.",
      });
      appendSingle({
        name: "Rendimento CDB Itaú",
        amount: 68 + index * 4.4,
        type: "income",
        paymentMethod: "bank_transfer",
        purchaseDate: dateForPeriodDay(period, 27),
        accountId: accountIds.itau,
        categoryId: categoryId("income", "Investimentos"),
        personId: adminPerson.id,
        note: "Rendimento líquido mensal.",
      });
      appendSingle({
        name: "Pão de Açúcar",
        amount: 280 + index * 22.4,
        type: "expense",
        paymentMethod: "credit_card",
        purchaseDate: dateForPeriodDay(period, 10),
        card: cardRows.itaucard,
        categoryId: categoryId("expense", "Mercado"),
        personId: adminPerson.id,
        note: "Hortifruti e itens para a semana.",
      });

      if (index % 2 === 0) {
        appendSingle({
          name: "Cinemark",
          amount: 130 + index * 8.5,
          type: "expense",
          paymentMethod: "credit_card",
          purchaseDate: dateForPeriodDay(period, 21),
          card: cardRows.itaucard,
          categoryId: categoryId("expense", "Lazer"),
          personId: adminPerson.id,
          note: "Ingressos e pipoca.",
        });
        appendSingle({
          name: "Drogasil",
          amount: 46 + index * 6.25,
          type: "expense",
          paymentMethod: "debit_card",
          purchaseDate: dateForPeriodDay(period, 12),
          accountId: accountIds.nubank,
          categoryId: categoryId("expense", "Saúde"),
          personId: adminPerson.id,
        });
      } else {
        appendSingle({
          name: "Freela - Clínica Aurora",
          amount: 1450 + index * 120,
          type: "income",
          paymentMethod: "pix",
          purchaseDate: dateForPeriodDay(period, 24),
          accountId: accountIds.nubank,
          categoryId: categoryId("income", "Freelance"),
          personId: adminPerson.id,
          note: "Projeto extra de landing page.",
        });
        appendSingle({
          name: "Coco Bambu",
          amount: 212 + index * 9.5,
          type: "expense",
          paymentMethod: "credit_card",
          purchaseDate: dateForPeriodDay(period, 25),
          card: cardRows.itaucard,
          categoryId: categoryId("expense", "Restaurantes"),
          personId: adminPerson.id,
        });
      }
    }

    appendSingle({
      name: "IPVA - parcela única",
      amount: 684.32,
      type: "expense",
      paymentMethod: "boleto",
      purchaseDate: dateForPeriodDay(lastPeriod, 10),
      dueDate: dateForPeriodDay(lastPeriod, 25),
      accountId: accountIds.itau,
      categoryId: categoryId("expense", "Transporte"),
      personId: adminPerson.id,
      settlement: "open",
      note: "Mantido em aberto para testar lembretes e boletos.",
    });
    appendSingle({
      name: "Reembolso plano de saúde",
      amount: 185.4,
      type: "income",
      paymentMethod: "pix",
      purchaseDate: dateForPeriodDay(middlePeriod, 26),
      accountId: accountIds.nubank,
      categoryId: categoryId("income", "Reembolso"),
      personId: adminPerson.id,
    });

    const recurringDefinitions: RecurringDefinition[] = [
      {
        id: randomUUID(),
        name: "Salário - OpenMonetis Labs",
        amount: 7800,
        type: "income",
        paymentMethod: "bank_transfer",
        startDate: dateForPeriodDay(firstPeriod, 5),
        personId: adminPerson.id,
        accountId: accountIds.nubank,
        categoryId: categoryId("income", "Salário"),
        note: "Salário mensal recebido via transferência.",
      },
      {
        id: randomUUID(),
        name: "Aluguel - Edifício Aurora",
        amount: 2800,
        type: "expense",
        paymentMethod: "pix",
        startDate: dateForPeriodDay(firstPeriod, 5),
        dueDate: dateForPeriodDay(firstPeriod, 8),
        personId: adminPerson.id,
        accountId: accountIds.nubank,
        categoryId: categoryId("expense", "Moradia"),
        note: "Despesa fixa dividida com Marina.",
        splitShares: [
          { personId: adminPerson.id, amount: 1400 },
          { personId: marinaId, amount: 1400 },
        ],
      },
      {
        id: randomUUID(),
        name: "Vivo Fibra",
        amount: 129.9,
        type: "expense",
        paymentMethod: "boleto",
        startDate: dateForPeriodDay(firstPeriod, 2),
        dueDate: dateForPeriodDay(firstPeriod, 12),
        personId: adminPerson.id,
        accountId: accountIds.itau,
        categoryId: categoryId("expense", "Internet"),
        note: "Internet residencial.",
      },
      {
        id: randomUUID(),
        name: "Conta de luz - Enel",
        amount: 186.4,
        type: "expense",
        paymentMethod: "boleto",
        startDate: dateForPeriodDay(firstPeriod, 3),
        dueDate: dateForPeriodDay(firstPeriod, 18),
        personId: adminPerson.id,
        accountId: accountIds.itau,
        categoryId: categoryId("expense", "Energia e água"),
        note: "Conta mensal de energia.",
      },
      {
        id: randomUUID(),
        name: "Netflix",
        amount: 55.9,
        type: "expense",
        paymentMethod: "credit_card",
        startDate: dateForPeriodDay(firstPeriod, 9),
        personId: adminPerson.id,
        cardId: cardRows.ultravioleta.id,
        categoryId: categoryId("expense", "Assinaturas"),
        note: "Assinatura mensal.",
        splitShares: [
          { personId: adminPerson.id, amount: 35.9 },
          { personId: marinaId, amount: 20 },
        ],
      },
      {
        id: randomUUID(),
        name: "Smart Fit",
        amount: 129.9,
        type: "expense",
        paymentMethod: "credit_card",
        startDate: dateForPeriodDay(firstPeriod, 11),
        personId: adminPerson.id,
        cardId: cardRows.ultravioleta.id,
        categoryId: categoryId("expense", "Saúde"),
        note: "Plano mensal da academia.",
      },
      {
        id: randomUUID(),
        name: "Condomínio - Edifício Aurora",
        amount: 680,
        type: "expense",
        paymentMethod: "pix",
        startDate: dateForPeriodDay(firstPeriod, 1),
        dueDate: dateForPeriodDay(firstPeriod, 10),
        personId: adminPerson.id,
        accountId: accountIds.nubank,
        categoryId: categoryId("expense", "Moradia"),
        note: "Taxa condominial mensal.",
      },
    ];
    const recurringSeriesRows = recurringDefinitions.map((definition) => ({
      id: randomUUID(),
      userId: targetUser.id,
      ruleId: definition.id,
    }));
    await tx
      .insert(recurringTransactionSeries)
      .values(recurringSeriesRows.map(({ id, userId }) => ({ id, userId })));
    const recurringSeriesByRule = new Map(
      recurringSeriesRows.map((series) => [series.ruleId, series.id]),
    );
    const recurringRows: NewRecurringTransactionRule[] = recurringDefinitions.map((definition) => ({
      id: definition.id,
      userId: targetUser.id,
      seriesId: recurringSeriesByRule.get(definition.id) as string,
      personId: definition.personId,
      type: definition.type,
      paymentMethod: definition.paymentMethod,
      name: definition.name,
      amount: normalizeTransactionAmount(definition.type, definition.amount).toFixed(2),
      anchorDate: toDate(definition.startDate),
      startDate: toDate(definition.startDate),
      endDate: null,
      frequency: "monthly",
      accountId: definition.accountId ?? null,
      cardId: definition.cardId ?? null,
      categoryId: definition.categoryId,
      sourceAccountId: null,
      destinationAccountId: null,
      dueDate: definition.dueDate ? toDate(definition.dueDate) : null,
      isSettled: false,
      note: definition.note,
      status: "active",
    }));
    await tx.insert(recurringTransactionRules).values(recurringRows);
    const recurringSplitRows = recurringDefinitions.flatMap((definition) =>
      (definition.splitShares ?? []).map((share) => ({
        id: randomUUID(),
        userId: targetUser.id,
        recurringRuleId: definition.id,
        personId: share.personId,
        amount: normalizeTransactionAmount(definition.type, share.amount).toFixed(2),
      })),
    );
    await tx.insert(recurringTransactionSplits).values(recurringSplitRows);
    const occurrenceRows = recurringDefinitions.flatMap((definition) =>
      periods.flatMap((period) =>
        listRecurrenceDatesInPeriod({
          startDate: definition.startDate,
          endDate: null,
          frequency: "monthly",
          period,
        }).map((purchaseDate) => {
          const settlementDate = definition.dueDate
            ? dateForPeriodDay(
                purchaseDate.slice(0, 7),
                Number.parseInt(definition.dueDate.slice(-2), 10),
              )
            : purchaseDate;
          const isSettled = definition.cardId ? false : settlementDate <= today;
          return {
            id: randomUUID(),
            userId: targetUser.id,
            recurringRuleId: definition.id,
            recurringSeriesId: recurringSeriesByRule.get(definition.id) as string,
            purchaseDate: toDate(purchaseDate),
            isSettled,
            accountId: definition.accountId ?? null,
            boletoPaymentDate:
              definition.paymentMethod === "boleto" && isSettled ? toDate(settlementDate) : null,
          };
        }),
      ),
    );
    await tx.insert(recurringTransactionOccurrences).values(occurrenceRows);
    summary.recurringRules += recurringRows.length;

    const appendInstallmentSeries = (input: {
      name: string;
      totalAmount: number;
      installmentCount: number;
      purchaseDate: string;
      card: SeedCard;
      categoryId: string;
      note: string;
      splitShares?: Array<{ personId: string; amount: number }>;
    }) => {
      const seriesId = randomUUID();
      const basePeriod = deriveTransactionPeriod({
        paymentMethod: "credit_card",
        purchaseDate: input.purchaseDate,
        card: {
          closingDay: input.card.closingDay,
          closingRule: { type: "fixedDay", closingDay: input.card.closingDay },
          dueDay: input.card.dueDay,
        },
      });
      const schedule = buildTrackedInstallmentSchedule({
        totalAmount: input.totalAmount,
        installmentCount: input.installmentCount,
        startInstallment: 1,
        basePeriod,
        paymentMethod: "credit_card",
      });
      const splitSchedules = (input.splitShares ?? []).map((share) => ({
        personId: share.personId,
        amounts: buildTrackedInstallmentSchedule({
          totalAmount: share.amount,
          installmentCount: input.installmentCount,
          startInstallment: 1,
          basePeriod,
          paymentMethod: "credit_card",
        }),
      }));

      const seriesTransactionIds: string[] = [];
      for (const installment of schedule) {
        const transactionId = randomUUID();
        seriesTransactionIds.push(transactionId);
        transactionRows.push({
          id: transactionId,
          userId: targetUser.id,
          personId: adminPerson.id,
          type: "expense",
          origin: "regular",
          condition: "installment",
          paymentMethod: "credit_card",
          name: input.name,
          amount: normalizeTransactionAmount("expense", installment.amount).toFixed(2),
          purchaseDate: toDate(input.purchaseDate),
          period: installment.period,
          accountId: null,
          cardId: input.card.id,
          categoryId: input.categoryId,
          installmentCount: input.installmentCount,
          currentInstallment: installment.currentInstallment,
          seriesId,
          isSettled: null,
          note: input.note,
        });
        seededPeriods.add(installment.period);
      }
      for (const split of splitSchedules) {
        split.amounts.forEach((installment, index) => {
          const transactionId = seriesTransactionIds[index] as string;
          splitRows.push({
            id: randomUUID(),
            userId: targetUser.id,
            transactionId,
            personId: split.personId,
            amount: normalizeTransactionAmount("expense", installment.amount).toFixed(2),
          });
        });
      }
      return {
        id: seriesId,
        userId: targetUser.id,
        totalInstallments: input.installmentCount,
        trackedFromInstallment: 1,
        originalAmount: input.totalAmount.toFixed(2),
      };
    };

    const seriesRows = [
      appendInstallmentSeries({
        name: "Notebook Dell Inspiron",
        totalAmount: 7199.2,
        installmentCount: 8,
        purchaseDate: dateForPeriodDay(firstPeriod, 12),
        card: cardRows.itaucard,
        categoryId: categoryId("expense", "Compras"),
        note: "Notebook para o home office.",
      }),
      appendInstallmentSeries({
        name: "Ar-condicionado Springer Midea",
        totalAmount: 2899.8,
        installmentCount: 6,
        purchaseDate: dateForPeriodDay(secondPeriod, 14),
        card: cardRows.ultravioleta,
        categoryId: categoryId("expense", "Moradia"),
        note: "Compra para o quarto.",
      }),
      appendInstallmentSeries({
        name: "Passagem LATAM - Salvador",
        totalAmount: 2140.5,
        installmentCount: 5,
        purchaseDate: dateForPeriodDay(thirdPeriod, 11),
        card: cardRows.ultravioleta,
        categoryId: categoryId("expense", "Viagem"),
        note: "Viagem dividida com Eduardo.",
        splitShares: [
          { personId: adminPerson.id, amount: 1498.35 },
          { personId: eduardoId, amount: 642.15 },
        ],
      }),
    ];
    await tx.insert(installmentSeries).values(seriesRows);
    summary.installmentSeries += seriesRows.length;

    await tx.insert(transactions).values(transactionRows);
    await tx.insert(transactionSplits).values(splitRows);

    const invoicePeriodsByCard = new Map<string, Set<string>>();
    for (const transaction of transactionRows) {
      if (!transaction.cardId) continue;
      const cardPeriods = invoicePeriodsByCard.get(transaction.cardId) ?? new Set<string>();
      cardPeriods.add(transaction.period);
      invoicePeriodsByCard.set(transaction.cardId, cardPeriods);
    }
    const recurringCardOccurrences = recurringDefinitions.flatMap((definition) => {
      if (!definition.cardId) return [];
      const card = Object.values(cardRows).find(
        (item) => item.id === definition.cardId,
      ) as SeedCard;
      return periods.flatMap((purchasePeriod) =>
        listRecurrenceDatesInPeriod({
          startDate: definition.startDate,
          endDate: null,
          frequency: "monthly",
          period: purchasePeriod,
        }).map((purchaseDate) => ({
          recurringRuleId: definition.id,
          purchaseDate,
          cardId: card.id,
          period: deriveTransactionPeriod({
            paymentMethod: "credit_card",
            purchaseDate,
            card: {
              closingDay: card.closingDay,
              closingRule: { type: "fixedDay", closingDay: card.closingDay },
              dueDay: card.dueDay,
            },
          }),
          amount: definition.amount,
        })),
      );
    });
    for (const occurrence of recurringCardOccurrences) {
      const cardPeriods = invoicePeriodsByCard.get(occurrence.cardId) as Set<string>;
      cardPeriods.add(occurrence.period);
      invoicePeriodsByCard.set(occurrence.cardId, cardPeriods);
    }

    for (const card of Object.values(cardRows)) {
      const cardPeriods = [...(invoicePeriodsByCard.get(card.id) as Set<string>)].sort();
      const historicalPeriods = cardPeriods.filter((period) => period <= today.slice(0, 7));
      const latestHistoricalPeriod = historicalPeriods.at(-1);

      for (const period of cardPeriods) {
        const dates = getInvoiceDates({
          period,
          closingDay: card.closingDay,
          closingRule: { type: "fixedDay", closingDay: card.closingDay },
          dueDay: card.dueDay,
        });
        const leavePending =
          dates.dueDate >= today ||
          (card.id === cardRows.ultravioleta.id && period === latestHistoricalPeriod);
        const cardTransactions = transactionRows.filter(
          (transaction) => transaction.cardId === card.id && transaction.period === period,
        );
        const recurringOccurrences = recurringCardOccurrences.filter(
          (occurrence) => occurrence.cardId === card.id && occurrence.period === period,
        );
        const allocationCentsByPerson = new Map<string, number>();
        const addAllocation = (personId: string, amount: string | number) => {
          const amountCents = Math.round(Math.abs(Number(amount)) * 100);
          allocationCentsByPerson.set(
            personId,
            (allocationCentsByPerson.get(personId) ?? 0) + amountCents,
          );
        };
        for (const transaction of cardTransactions) {
          const transactionShareRows = splitRows.filter(
            (split) => split.transactionId === transaction.id,
          );
          if (transactionShareRows.length) {
            for (const share of transactionShareRows) {
              addAllocation(share.personId, share.amount);
            }
          } else {
            addAllocation(transaction.personId as string, transaction.amount);
          }
        }
        for (const occurrence of recurringOccurrences) {
          const definition = recurringDefinitions.find(
            (item) => item.id === occurrence.recurringRuleId,
          ) as RecurringDefinition;
          if (definition.splitShares?.length) {
            for (const share of definition.splitShares) {
              addAllocation(share.personId, share.amount);
            }
          } else {
            addAllocation(definition.personId, occurrence.amount);
          }
        }
        const paymentAllocations = [...allocationCentsByPerson].map(([personId, amountCents]) => ({
          personId,
          amount: amountCents / 100,
        }));
        const paymentAmount = paymentAllocations.reduce(
          (total, allocation) => total + allocation.amount,
          0,
        );
        const invoiceId = randomUUID();
        await tx.insert(invoices).values({
          id: invoiceId,
          userId: targetUser.id,
          cardId: card.id,
          period,
          paymentStatus: leavePending ? "pending" : "paid",
          paidAt: leavePending ? null : new Date(`${dates.dueDate}T12:00:00.000Z`),
          paymentAccountId: leavePending ? null : card.accountId,
          closingDate: toDate(dates.closingDate),
          dueDate: toDate(dates.dueDate),
        });
        summary.invoices += 1;

        if (!leavePending && paymentAmount > 0) {
          const paymentTransactionId = randomUUID();
          await tx.insert(transactions).values({
            id: paymentTransactionId,
            userId: targetUser.id,
            personId: adminPerson.id,
            type: "expense",
            origin: "invoicePayment",
            condition: "single",
            paymentMethod: "bank_transfer",
            name: `Pagamento fatura - ${card.name}`,
            amount: (-paymentAmount).toFixed(2),
            purchaseDate: toDate(dates.dueDate),
            period,
            accountId: card.accountId,
            categoryId: categoryId("expense", invoicePaymentCategoryName),
            isSettled: true,
            note: `Pagamento automático da fatura ${period}.`,
          });
          const paymentId = randomUUID();
          await tx.insert(invoicePayments).values({
            id: paymentId,
            userId: targetUser.id,
            cardId: card.id,
            period,
            accountId: card.accountId,
            transactionId: paymentTransactionId,
            amount: paymentAmount.toFixed(2),
            paidAt: toDate(dates.dueDate),
          });
          await tx.insert(invoicePaymentAllocations).values(
            paymentAllocations.map((allocation) => ({
              id: randomUUID(),
              userId: targetUser.id,
              paymentId,
              personId: allocation.personId,
              amount: allocation.amount.toFixed(2),
            })),
          );
          await settleCardTransactions(tx, cardTransactions);
          for (const occurrence of recurringOccurrences) {
            await tx
              .update(recurringTransactionOccurrences)
              .set({ isSettled: true })
              .where(
                and(
                  eq(recurringTransactionOccurrences.recurringRuleId, occurrence.recurringRuleId),
                  eq(recurringTransactionOccurrences.purchaseDate, toDate(occurrence.purchaseDate)),
                ),
              );
          }
          summary.invoicePayments += 1;
          summary.transactions += 1;
          seededPeriods.add(period);
        }
      }
    }

    summary.transactions += transactionRows.length;

    const inboxDefinitions = [
      {
        sourceApp: "com.nu.production",
        sourceAppName: "Nubank",
        title: "Compra aprovada",
        text: "Compra de R$ 73,90 aprovada no cartão Ultravioleta em RAPPI*RAPPI BR",
        name: "Rappi",
        amount: "73.90",
        day: 3,
      },
      {
        sourceApp: "com.nu.production",
        sourceAppName: "Nubank",
        title: "Pix enviado",
        text: "Você enviou R$ 210,00 via Pix para Marina Oliveira.",
        name: "Marina Oliveira",
        amount: "210.00",
        day: 5,
      },
      {
        sourceApp: "br.com.itau.personnalite",
        sourceAppName: "Itaú Personnalité",
        title: "Débito em conta",
        text: "Débito de R$ 45,80 realizado. PADARIA NOSSA SENHORA",
        name: "Padaria Nossa Senhora",
        amount: "45.80",
        day: 7,
      },
      {
        sourceApp: "com.mercadopago.wallet",
        sourceAppName: "Mercado Pago",
        title: null,
        text: "Pagamento de R$ 38,50 aprovado em 99APP*CORRIDA",
        name: "99App",
        amount: "38.50",
        day: 13,
      },
      {
        sourceApp: "com.nu.production",
        sourceAppName: "Nubank",
        title: "Compra aprovada",
        text: "Compra de R$ 124,90 aprovada no cartão Ultravioleta em SHOPEE*SHOPEE BR",
        name: "Shopee",
        amount: "124.90",
        day: 18,
      },
    ];
    await tx.insert(inboxItems).values(
      inboxDefinitions.map((item, index) => {
        const clientId = `mock-seed-${targetUser.id}-${index + 1}`;
        return {
          id: randomUUID(),
          userId: targetUser.id,
          deviceTokenId: null,
          sourceApp: item.sourceApp,
          sourceAppName: item.sourceAppName,
          originalTitle: item.title,
          originalText: item.text,
          notificationTimestamp: new Date(
            `${dateForPeriodDay(lastPeriod, item.day)}T12:00:00.000Z`,
          ),
          parsedName: item.name,
          parsedAmount: item.amount,
          clientId,
          payloadFingerprint: fingerprint(`${clientId}:${item.text}`),
          status: "pending" as const,
          transactionId: null,
          processedAt: null,
          discardedAt: null,
        };
      }),
    );
    summary.inboxItems += inboxDefinitions.length;
  });

  const sortedSeededPeriods = [...seededPeriods].sort();
  console.log("Seed concluído com sucesso.");
  console.log(
    JSON.stringify(
      {
        userId: targetUser.id,
        userEmail: targetUser.email,
        startPeriod: options.startPeriod,
        months: options.months,
        seededFrom: sortedSeededPeriods[0] as string,
        seededTo: sortedSeededPeriods.at(-1) as string,
        todayPeriod: today.slice(0, 7),
        summary,
      },
      null,
      2,
    ),
  );
}

export function isDirectExecution(executablePath = process.argv[1], moduleUrl = import.meta.url) {
  return Boolean(executablePath && pathToFileURL(resolve(executablePath)).href === moduleUrl);
}

export async function settleCardTransactions(
  transaction: Parameters<Parameters<typeof db.transaction>[0]>[0],
  cardTransactions: NewTransaction[],
) {
  if (!cardTransactions.length) return;
  await transaction
    .update(transactions)
    .set({ isSettled: true })
    .where(
      inArray(
        transactions.id,
        cardTransactions.map((item) => item.id as string),
      ),
    );
}

export function getMockDataErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Erro inesperado ao popular a conta.";
}

export async function runMockDataProcess(argv = process.argv.slice(2)) {
  try {
    await seedMockData(argv);
  } catch (error) {
    console.error(getMockDataErrorMessage(error));
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (isDirectExecution()) {
  void runMockDataProcess();
}
