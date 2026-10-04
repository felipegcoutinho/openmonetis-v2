import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput, CreateCardInput, ReplaceCardInput } from "@openmonetis/validators/cards";

export type CardFormProps = {
  accounts: AccountOutput[];
  card?: CardOutput | null;
  onCancel: () => void;
  onSubmit: (input: CreateCardInput | ReplaceCardInput) => Promise<void>;
};

export type FormValues = {
  name: string;
  brand: CardOutput["brand"];
  status: CardOutput["status"];
  limit: string;
  closingDay: string;
  closingDayPurchasesNextInvoice: boolean;
  closingRuleType: CardOutput["closingRuleType"];
  closingOffsetDays: string;
  closingOffsetMode: NonNullable<CardOutput["closingOffsetMode"]>;
  dueDay: string;
  accountId: string;
  logo: string | null;
  note: string;
};
