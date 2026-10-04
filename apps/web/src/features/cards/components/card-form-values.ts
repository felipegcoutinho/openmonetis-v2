import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";

import { formatCurrency } from "../cards.presentation";
import type { FormValues } from "./card-form.types";

export function initialValues(
  card: CardOutput | null | undefined,
  accounts: AccountOutput[],
): FormValues {
  return {
    name: card?.name ?? "",
    brand: card?.brand ?? "mastercard",
    status: card?.status ?? "active",
    limit: formatCurrency(card?.limit ?? 0),
    closingDay: String(card?.closingDay ?? 1),
    closingDayPurchasesNextInvoice: card?.closingDayPurchasesNextInvoice ?? false,
    closingRuleType: card?.closingRuleType ?? "fixedDay",
    closingOffsetDays: String(card?.closingOffsetDays ?? 7),
    closingOffsetMode: card?.closingOffsetMode ?? "calendarDays",
    dueDay: String(card?.dueDay ?? 10),
    accountId: card?.accountId ?? accounts[0]?.id ?? "",
    logo: card?.logo ?? null,
    note: card?.note ?? "",
  };
}
