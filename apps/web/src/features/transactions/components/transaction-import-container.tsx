import type { ImportTransactionsInput } from "@openmonetis/validators/transactions";
import { useQueries } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";
import {
  useImportTransactionsMutation,
  usePreviewTransactionImportMutation,
  useTransactionImportTemplateMutation,
  useUndoTransactionImportMutation,
} from "../transactions.mutations";
import { TransactionImportScreen } from "./transaction-import-screen";

export function TransactionImportContainer() {
  const navigate = useNavigate();
  const preview = usePreviewTransactionImportMutation();
  const importMutation = useImportTransactionsMutation();
  const undoMutation = useUndoTransactionImportMutation();
  const templateMutation = useTransactionImportTemplateMutation();
  const [accounts, cards, categories, people] = useQueries({
    queries: [
      accountsQueryOptions(),
      cardsQueryOptions(),
      categoriesQueryOptions(),
      peopleQueryOptions(),
    ],
  });

  return (
    <TransactionImportScreen
      accounts={accounts.data?.filter((account) => !account.isArchived) ?? []}
      cards={cards.data?.filter((card) => card.status === "active") ?? []}
      categories={categories.data ?? []}
      isLoadingOptions={[accounts, cards, categories, people].some((query) => query.isLoading)}
      isDownloadingTemplate={templateMutation.isPending}
      onImport={async (input: ImportTransactionsInput, onImported) => {
        const result = await importMutation.mutateAsync(input);
        onImported();
        await navigate({ to: "/transactions" });
        toast.success(
          result.skipped
            ? `${result.imported} importados e ${result.skipped} duplicados ignorados`
            : `${result.imported} lançamentos importados`,
          {
            duration: 8000,
            action: result.imported
              ? {
                  label: "Desfazer",
                  onClick: () => {
                    void undoMutation
                      .mutateAsync(result.batchId)
                      .then(() => toast.success("Importação desfeita"))
                      .catch(() => toast.error("Não foi possível desfazer a importação"));
                  },
                }
              : undefined,
          },
        );
      }}
      onPreview={(file) => preview.mutateAsync(file)}
      onDownloadTemplate={() => templateMutation.mutateAsync()}
      people={people.data?.filter((person) => person.status === "active") ?? []}
      isImporting={importMutation.isPending}
      isPreviewing={preview.isPending}
    />
  );
}
