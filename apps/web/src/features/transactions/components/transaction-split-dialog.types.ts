import type { PersonOutput } from "@openmonetis/validators/people";

export type SplitFormShare = { personId: string; amount: string };

export type SplitMode = "amount" | "percentage";

export type PercentageFormShare = { personId: string; percentage: string };

export type TransactionSplitDialogProps = {
  amount: string;
  disabled: boolean;
  onChange: (shares: SplitFormShare[]) => void;
  people: PersonOutput[];
  primaryPersonId: string;
  value: SplitFormShare[];
};
