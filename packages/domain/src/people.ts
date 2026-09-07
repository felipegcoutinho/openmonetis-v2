export type AuthenticatedUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  providerAvatarUrl?: string | null;
};

export type AdminPersonDraft = {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  providerAvatarUrl: string | null;
  note: null;
  role: "admin";
  status: "active";
};

export const defaultAdminPersonAvatarUrl = "/avatars/default_icon.png";

type CreateAdminPersonDraftOptions = {
  avatarUrl?: string | null;
};

export class PersonStatusRuleError extends Error {
  readonly code = "admin_person_must_be_active";

  constructor() {
    super("The admin person must remain active");
    this.name = "PersonStatusRuleError";
  }
}

export function assertPersonStatusAllowed(
  role: "admin" | "external",
  status: "active" | "inactive",
) {
  if (role === "admin" && status === "inactive") throw new PersonStatusRuleError();
}

export function createAdminPersonDraft(
  user: AuthenticatedUser,
  options: CreateAdminPersonDraftOptions = {},
): AdminPersonDraft {
  return {
    userId: user.id,
    name: user.name.trim() || "Administrador",
    email: user.email,
    avatarUrl: options.avatarUrl?.trim() || defaultAdminPersonAvatarUrl,
    providerAvatarUrl: user.providerAvatarUrl?.trim() || null,
    note: null,
    role: "admin",
    status: "active",
  };
}

export type ExternalPersonDraft = {
  userId: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  providerAvatarUrl: null;
  note: string | null;
  role: "external";
  status: "active" | "inactive";
};

export function createExternalPersonDraft(
  input: Omit<ExternalPersonDraft, "providerAvatarUrl" | "role">,
): ExternalPersonDraft {
  return {
    ...input,
    name: input.name.trim(),
    email: input.email?.trim() || null,
    avatarUrl: input.avatarUrl?.trim() || null,
    providerAvatarUrl: null,
    note: input.note?.trim() || null,
    role: "external",
  };
}

export type PersonFinancialEntry = {
  amount: number;
  paymentMethod:
    | "credit_card"
    | "debit_card"
    | "pix"
    | "cash"
    | "boleto"
    | "benefits"
    | "bank_transfer";
  period: string;
  type: "income" | "expense" | "transfer";
};

const personPaymentMethods = [
  "credit_card",
  "debit_card",
  "pix",
  "cash",
  "boleto",
  "benefits",
  "bank_transfer",
] as const;

export function calculatePersonFinancialSummary(
  entries: PersonFinancialEntry[],
  periods: string[],
  selectedPeriod: string,
) {
  const expensesByPeriod = new Map(periods.map((period) => [period, 0]));
  const paymentMethodTotals = new Map<PersonFinancialEntry["paymentMethod"], number>(
    personPaymentMethods.map((method) => [method, 0]),
  );
  for (const entry of entries) {
    if (entry.type !== "expense" || !expensesByPeriod.has(entry.period)) continue;
    const amount = Math.abs(Math.round(entry.amount * 100));
    expensesByPeriod.set(entry.period, (expensesByPeriod.get(entry.period) as number) + amount);

    if (entry.period === selectedPeriod && paymentMethodTotals.has(entry.paymentMethod)) {
      paymentMethodTotals.set(
        entry.paymentMethod,
        (paymentMethodTotals.get(entry.paymentMethod) as number) + amount,
      );
    }
  }

  const totalExpensesCents = expensesByPeriod.get(selectedPeriod) ?? 0;
  const highestHistoryCents = Math.max(0, ...expensesByPeriod.values());

  return {
    period: selectedPeriod,
    totalExpenses: totalExpensesCents / 100,
    history: periods.map((period) => {
      const expensesCents = expensesByPeriod.get(period) as number;
      return {
        period,
        expenses: expensesCents / 100,
        percentage:
          highestHistoryCents > 0 ? Math.round((expensesCents / highestHistoryCents) * 100) : 0,
      };
    }),
    paymentMethods: personPaymentMethods.map((paymentMethod) => {
      const amountCents = paymentMethodTotals.get(paymentMethod) as number;
      return {
        paymentMethod,
        amount: amountCents / 100,
        percentage:
          totalExpensesCents > 0 ? Math.round((amountCents / totalExpensesCents) * 1_000) / 10 : 0,
      };
    }),
  };
}
