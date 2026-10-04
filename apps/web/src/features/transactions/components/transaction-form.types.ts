import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";

import type { ReactNode, Ref } from "react";

import type {
  TransactionCreateDefaults,
  TransactionFormValues,
} from "./transaction-form.validation";

export type TransactionFormProps = {
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  transaction: TransactionOutput | null;
  mode?: "create" | "edit" | "copy";
  defaultType?: TransactionInput["type"];
  defaultPeriod?: string;
  createDefaults?: TransactionCreateDefaults;
  allowedConditions?: readonly TransactionFormValues["condition"][];
  lockType?: boolean;
  showTypeSelector?: boolean;
  submitLabel?: string;
  attachmentBusy?: boolean;
  establishments?: string[];
  establishmentsLoading?: boolean;
  onAttachmentBusyChange?: (busy: boolean) => void;
  onCreate?: (input: TransactionInput) => Promise<TransactionOutput>;
  onCreated?: (transaction: TransactionOutput) => Promise<void> | void;
  onSaved: () => void;
  onCancel: () => void;
  ref?: Ref<TransactionFormHandle>;
};

export type TransactionFormHandle = {
  hasUnsavedChanges: () => boolean;
  isSubmitting: () => boolean;
};

export type FieldShellProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

export type AccountSelectProps = {
  accounts: AccountOutput[];
  value: string;
  disabled: boolean;
  error: boolean;
  onChange: (value: string) => void;
  onCreate: () => void;
};
