import {
  type AccountPeriodSummary,
  type AccountType,
  calculateAccountPeriodSummary,
  createAccountBalanceAdjustmentDraft,
  createAccountDraft,
  createAccountYieldDraft,
} from "@openmonetis/domain/accounts";
import {
  addMonthsToPeriod,
  buildTransferPostings,
  deriveTransactionPeriod,
  deriveTransactionPostingPeriod,
  getPeriodFromDate,
  listRecurrenceDatesInPeriod,
  type PaymentMethod,
  type RecurrenceFrequency,
  type TransactionType,
} from "@openmonetis/domain/transactions";
import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  AccountOutput,
  AddAccountYieldInput,
  AdjustAccountBalanceInput,
  CreateAccountInput,
  ReplaceAccountInput,
  UpdateAccountInput,
} from "@openmonetis/validators/accounts";
import { badRequest, conflict, notFound } from "../utils/errors";

export type AccountRecord = {
  id: string;
  userId: string;
  name: string;
  type: AccountType;
  logo: string | null;
  note: string | null;
  excludeFromBalance: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type AccountCreateRecord = {
  userId: string;
  name: string;
  type: AccountType;
  logo: string | null;
  note: string | null;
  excludeFromBalance: boolean;
};

type AccountUpdateRecord = Partial<Omit<AccountCreateRecord, "userId"> & { isArchived: boolean }>;

export type AccountBalancePostingRecord = {
  accountId: string | null;
  period: string;
  amount: string;
  includeInSummary?: boolean;
  paymentMethod?: PaymentMethod | null;
  boletoPaymentDate?: string | null;
};

type AccountBalanceAdjustmentRecord = {
  accountId: string;
  accountName: string;
  amount: string;
  date: string;
  type: "expense" | "income";
  userId: string;
  note: string;
};

type AccountYieldRecord = {
  accountId: string;
  accountName: string;
  amount: string;
  date: string;
  userId: string;
  note: string;
};

type DeleteAccountResult =
  | { status: "active" }
  | { status: "deleted"; id: string }
  | { status: "not_found" };

export type AccountRecurringRuleRecord = {
  id: string;
  accountId: string | null;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amount: string;
  type: TransactionType;
  paymentMethod: PaymentMethod;
  startDate: string;
  endDate?: string | null;
  dueDate: string | null;
  frequency: RecurrenceFrequency;
  isSettled: boolean | null;
};

export type AccountRecurringOccurrenceRecord = {
  recurringRuleId: string;
  purchaseDate: string;
  isSettled: boolean;
  accountId: string | null;
  boletoPaymentDate: string | null;
};

export type AccountsRepository = {
  insert(data: AccountCreateRecord): Promise<AccountRecord>;
  insertBalanceAdjustment(data: AccountBalanceAdjustmentRecord): Promise<void>;
  insertYield(data: AccountYieldRecord): Promise<void>;
  deleteInactiveForUser(id: string, userId: string): Promise<DeleteAccountResult>;
  listByUser(userId: string): Promise<AccountRecord[]>;
  findByIdForUser(id: string, userId: string): Promise<AccountRecord | null>;
  updateForUser(
    id: string,
    userId: string,
    data: AccountUpdateRecord,
  ): Promise<AccountRecord | null>;
  listSettledAccountPostingsThroughPeriod(
    userId: string,
    period: string,
    accountId?: string,
  ): Promise<AccountBalancePostingRecord[]>;
  listAccountRecurringRulesThroughPeriod(
    userId: string,
    periodEnd: Date,
    accountId?: string,
  ): Promise<AccountRecurringRuleRecord[]>;
  listRecurringOccurrenceStatesThroughPeriod(
    userId: string,
    recurringRuleIds: string[],
    periodEnd: Date,
  ): Promise<AccountRecurringOccurrenceRecord[]>;
};

function toAccountOutput(account: AccountRecord, summary: AccountPeriodSummary): AccountOutput {
  return {
    id: account.id,
    name: account.name,
    type: account.type,
    logo: account.logo,
    note: account.note,
    excludeFromBalance: account.excludeFromBalance,
    isArchived: account.isArchived,
    summary,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

export function createAccountsService(repository: AccountsRepository) {
  async function summarizeAccounts(accounts: AccountRecord[], userId: string, period: string) {
    const accountId = accounts.length === 1 ? accounts[0]?.id : undefined;
    const [persistedPostings, recurringRules] = await Promise.all([
      repository.listSettledAccountPostingsThroughPeriod(userId, period, accountId),
      repository.listAccountRecurringRulesThroughPeriod(userId, getPeriodEnd(period), accountId),
    ]);
    const occurrenceStates = await repository.listRecurringOccurrenceStatesThroughPeriod(
      userId,
      recurringRules.map((rule) => rule.id),
      getPeriodEnd(period),
    );
    const postings = [
      ...persistedPostings
        .map((posting) => ({
          ...posting,
          period: deriveTransactionPostingPeriod({
            period: posting.period,
            paymentMethod: posting.paymentMethod ?? null,
            boletoPaymentDate: posting.boletoPaymentDate,
          }),
        }))
        .filter((posting) => posting.period <= period),
      ...expandSettledRecurringPostings(recurringRules, occurrenceStates, period),
    ];
    const postingsByAccount = new Map<string, AccountBalancePostingRecord[]>();

    for (const posting of postings) {
      if (!posting.accountId) continue;
      const accountPostings = postingsByAccount.get(posting.accountId) ?? [];
      accountPostings.push(posting);
      postingsByAccount.set(posting.accountId, accountPostings);
    }

    return accounts.map((account) =>
      toAccountOutput(
        account,
        calculateAccountPeriodSummary({
          period,
          postings: (postingsByAccount.get(account.id) ?? []).map((posting) => ({
            period: posting.period,
            amount: Number(posting.amount),
            includeInSummary: posting.includeInSummary,
          })),
        }),
      ),
    );
  }

  async function summarizeAccount(account: AccountRecord, userId: string, period: string) {
    const [output] = await summarizeAccounts([account], userId, period);
    return output as AccountOutput;
  }

  async function getBalanceSnapshot(accountId: string, userId: string, period: string) {
    const account = await repository.findByIdForUser(accountId, userId);
    if (!account) throw notFound("Account not found", "account_not_found");

    const [persistedPostings, recurringRules] = await Promise.all([
      repository.listSettledAccountPostingsThroughPeriod(userId, period, accountId),
      repository.listAccountRecurringRulesThroughPeriod(userId, getPeriodEnd(period), accountId),
    ]);
    const occurrenceStates = await repository.listRecurringOccurrenceStatesThroughPeriod(
      userId,
      recurringRules.map((rule) => rule.id),
      getPeriodEnd(period),
    );
    const recurringPostings = expandSettledRecurringPostings(
      recurringRules,
      occurrenceStates,
      period,
    );
    const toBalance = (postings: AccountBalancePostingRecord[]) =>
      calculateAccountPeriodSummary({
        period,
        postings: postings
          .filter((posting) => posting.accountId === accountId)
          .map((posting) => ({
            period: posting.period,
            amount: Number(posting.amount),
            includeInSummary: posting.includeInSummary,
          })),
      }).balance;

    return {
      displayed: toBalance([...persistedPostings, ...recurringPostings]),
      persisted: toBalance(persistedPostings),
    };
  }

  return {
    getBalanceSnapshot,
    async create(input: CreateAccountInput, userId: string) {
      const account = await repository.insert(
        createAccountDraft({
          userId,
          name: input.name,
          type: input.type,
          logo: input.logo ?? null,
          note: input.note ?? null,
          excludeFromBalance: input.excludeFromBalance,
        }),
      );
      return summarizeAccount(account, userId, currentPeriod());
    },

    async list(userId: string, period = currentPeriod()) {
      return summarizeAccounts(await repository.listByUser(userId), userId, period);
    },

    async get(id: string, userId: string, period = currentPeriod()) {
      const account = await repository.findByIdForUser(id, userId);

      if (!account) {
        throw notFound("Account not found", "account_not_found");
      }

      return summarizeAccount(account, userId, period);
    },

    async replace(id: string, userId: string, input: ReplaceAccountInput) {
      const account = await repository.updateForUser(id, userId, {
        name: input.name,
        type: input.type,
        logo: input.logo ?? null,
        note: input.note ?? null,
        excludeFromBalance: input.excludeFromBalance,
        isArchived: input.isArchived,
      });

      if (!account) {
        throw notFound("Account not found", "account_not_found");
      }

      return summarizeAccount(account, userId, currentPeriod());
    },

    async update(id: string, userId: string, input: UpdateAccountInput) {
      const values: AccountUpdateRecord = {};

      if (input.name !== undefined) values.name = input.name;
      if (input.type !== undefined) values.type = input.type;
      if (input.logo !== undefined) values.logo = input.logo ?? null;
      if (input.note !== undefined) values.note = input.note ?? null;
      if (input.excludeFromBalance !== undefined) {
        values.excludeFromBalance = input.excludeFromBalance;
      }
      if (input.isArchived !== undefined) values.isArchived = input.isArchived;

      const account = await repository.updateForUser(id, userId, values);

      if (!account) {
        throw notFound("Account not found", "account_not_found");
      }

      return summarizeAccount(account, userId, currentPeriod());
    },

    async adjustBalance(id: string, userId: string, input: AdjustAccountBalanceInput) {
      const account = await repository.findByIdForUser(id, userId);
      if (!account || account.isArchived) {
        throw notFound("Account not found", "account_not_found");
      }

      const period = input.date.slice(0, 7);
      const current = await summarizeAccount(account, userId, period);
      const adjustment = createAccountBalanceAdjustmentDraft(
        current.summary.balance,
        input.balance,
      );

      if (adjustment) {
        await repository.insertBalanceAdjustment({
          accountId: account.id,
          accountName: account.name,
          ...adjustment,
          userId,
          date: input.date,
          note: createBalanceChangeNote("Ajuste de saldo", current.summary.balance, input.balance),
        });
      }

      return summarizeAccount(account, userId, period);
    },

    async addYield(id: string, userId: string, input: AddAccountYieldInput) {
      const account = await repository.findByIdForUser(id, userId);
      if (!account || account.isArchived) {
        throw notFound("Account not found", "account_not_found");
      }

      const period = input.date.slice(0, 7);
      const current = await summarizeAccount(account, userId, period);
      let accountYield: ReturnType<typeof createAccountYieldDraft>;
      try {
        accountYield = createAccountYieldDraft(current.summary.balance, input);
      } catch {
        throw badRequest("Yield must increase the account balance", "positive_yield_required");
      }

      await repository.insertYield({
        accountId: account.id,
        accountName: account.name,
        amount: accountYield.amount,
        date: input.date,
        userId,
        note: [
          createBalanceChangeNote(
            "Rendimento",
            accountYield.previousBalance,
            accountYield.currentBalance,
          ),
          `Valor do rendimento: ${formatCurrency(Number(accountYield.amount))}.`,
        ].join(" "),
      });

      return summarizeAccount(account, userId, period);
    },

    async remove(id: string, userId: string) {
      const result = await repository.deleteInactiveForUser(id, userId);

      if (result.status === "not_found") {
        throw notFound("Account not found", "account_not_found");
      }
      if (result.status === "active") {
        throw conflict(
          "Only inactive accounts can be permanently deleted",
          "account_must_be_inactive",
        );
      }

      return { id: result.id };
    },
  };
}

export type AccountsService = ReturnType<typeof createAccountsService>;

function currentPeriod() {
  return getCurrentPeriodInBrazil();
}

function createBalanceChangeNote(label: string, previousBalance: number, currentBalance: number) {
  return `${label}. Saldo anterior: ${formatCurrency(previousBalance)}. Saldo atual: ${formatCurrency(currentBalance)}.`;
}

function formatCurrency(amount: number) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getPeriodEnd(period: string) {
  const [year, month] = period.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0));
}

function expandSettledRecurringPostings(
  rules: AccountRecurringRuleRecord[],
  occurrenceStates: AccountRecurringOccurrenceRecord[],
  throughPeriod: string,
): AccountBalancePostingRecord[] {
  const states = new Map(
    occurrenceStates.map((occurrence) => [
      `${occurrence.recurringRuleId}:${occurrence.purchaseDate}`,
      occurrence,
    ]),
  );

  return rules.flatMap((rule) => {
    const postings: AccountBalancePostingRecord[] = [];
    const latestTrackedPeriod = occurrenceStates
      .filter((occurrence) => occurrence.recurringRuleId === rule.id)
      .reduce(
        (latest, occurrence) =>
          getPeriodFromDate(occurrence.purchaseDate) > latest
            ? getPeriodFromDate(occurrence.purchaseDate)
            : latest,
        throughPeriod,
      );

    for (
      let purchasePeriod = getPeriodFromDate(rule.startDate);
      purchasePeriod <= latestTrackedPeriod;
      purchasePeriod = addMonthsToPeriod(purchasePeriod, 1)
    ) {
      for (const purchaseDate of listRecurrenceDatesInPeriod({
        startDate: rule.startDate,
        endDate: rule.endDate,
        frequency: rule.frequency,
        period: purchasePeriod,
      })) {
        const occurrence = states.get(`${rule.id}:${purchaseDate}`);
        if (purchasePeriod > throughPeriod && !occurrence) continue;
        if ((occurrence?.isSettled ?? rule.isSettled) !== true) continue;

        const scheduledPeriod = deriveTransactionPeriod({
          paymentMethod: rule.paymentMethod,
          purchaseDate,
          dueDate: getRecurringOccurrenceDueDate(rule.dueDate, purchaseDate),
        });
        const period = deriveTransactionPostingPeriod({
          period: scheduledPeriod,
          paymentMethod: rule.paymentMethod,
          boletoPaymentDate: occurrence?.boletoPaymentDate,
        });
        if (period > throughPeriod) continue;
        if (rule.type === "transfer" && rule.sourceAccountId && rule.destinationAccountId) {
          postings.push(
            ...buildTransferPostings({
              sourceAccountId: rule.sourceAccountId,
              destinationAccountId: rule.destinationAccountId,
              amount: Number(rule.amount),
            }).map((posting) => ({
              accountId: posting.accountId,
              period,
              amount: posting.amount.toFixed(2),
            })),
          );
        } else if (occurrence?.accountId ?? rule.accountId) {
          postings.push({
            accountId: occurrence?.accountId ?? rule.accountId,
            period,
            amount: rule.amount,
          });
        }
      }
    }

    return postings;
  });
}

function getRecurringOccurrenceDueDate(dueDate: string | null, purchaseDate: string) {
  if (!dueDate) return null;
  const purchase = new Date(`${purchaseDate}T00:00:00.000Z`);
  const dueDay = new Date(`${dueDate}T00:00:00.000Z`).getUTCDate();
  const lastDay = new Date(
    Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth() + 1, 0),
  ).getUTCDate();

  return new Date(
    Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth(), Math.min(dueDay, lastDay)),
  )
    .toISOString()
    .slice(0, 10);
}
