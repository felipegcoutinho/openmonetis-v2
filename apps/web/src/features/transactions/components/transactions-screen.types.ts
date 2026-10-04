import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type {
  TransactionActionScope,
  TransactionInput,
  TransactionOutput,
} from "@openmonetis/validators/transactions";

import type { ReactNode } from "react";

import type { PageBreadcrumb } from "@/components/page-header";

import type { TransactionsSearch } from "../transactions.presentation";

import type { TransactionCreateDefaults } from "./transaction-form.validation";

export type TransactionsScreenProps = {
  accountStatement?: boolean;
  transactions: TransactionOutput[];
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  period: string;
  isLoading: boolean;
  hasLoadError: boolean;
  pendingTransactionId: string | null;
  pendingSettlementKey: string | null;
  pageCount: number;
  totalItems: number;
  onRetry: () => void;
  isUpdating?: boolean;
  onPeriodChange?: (period: string) => void;
  periodNavigationPlacement?: "afterPageHeader" | "afterSummary";
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
  onDeleteTransaction: (
    transaction: TransactionOutput,
    scope?: TransactionActionScope,
  ) => Promise<void> | void;
  onSettleTransactions: (
    ids: string[],
    isSettled: boolean,
    settledDate?: string,
  ) => Promise<void> | void;
  onSettleRecurringOccurrence: (
    recurringRuleId: string,
    purchaseDate: string,
    isSettled: boolean,
    settledDate?: string,
  ) => Promise<void> | void;
  onRecurringStatus: (
    id: string,
    status: "active" | "paused" | "cancelled",
  ) => Promise<void> | void;
  header?: TransactionsScreenHeader;
  hiddenFilters?: readonly TransactionsFilterKey[];
  allowCreate?: boolean;
  allowImport?: boolean;
  createDefaults?: TransactionCreateDefaults;
  createTypes?: readonly TransactionCreateType[];
  defaultPageSize?: number;
  contentNavigation?: ReactNode;
  contentOverride?: ReactNode;
};

export type TransactionCreateType = TransactionInput["type"];

export type TransactionsFilterKey =
  | "type"
  | "paymentMethod"
  | "accountCard"
  | "category"
  | "person"
  | "settlement";

export type TransactionsScreenHeader = {
  breadcrumbs: PageBreadcrumb[];
  description?: string;
  icon?: ReactNode;
  summary?: ReactNode;
  title?: string;
};
