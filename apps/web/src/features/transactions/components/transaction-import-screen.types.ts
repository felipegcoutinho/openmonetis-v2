import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type { TransactionImportPreview } from "@openmonetis/validators/transactions";

export type PreviewRow = TransactionImportPreview["transactions"][number];

export type ReviewRow = PreviewRow & {
  rowKey: string;
  selected: boolean;
  personId: string;
  categoryId: string;
};

export type Props = {
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  isLoadingOptions: boolean;
  isDownloadingTemplate: boolean;
  isPreviewing: boolean;
  isImporting: boolean;
  onPreview: (file: File) => Promise<TransactionImportPreview>;
  onDownloadTemplate: () => Promise<{ fileName: string; contentBase64: string }>;
  onImport: (
    input: import("@openmonetis/validators/transactions").ImportTransactionsInput,
    onImported: () => void,
  ) => Promise<void>;
};
