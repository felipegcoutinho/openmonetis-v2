import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { TransactionDeepLinkDialog } from "@/features/transactions/components/transaction-deep-link-dialog";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import { validateTransactionsSearch } from "@/features/transactions/transactions.presentation";

export const Route = createFileRoute("/transactions")({
  head: () => ({ meta: [{ title: "Lançamentos · OpenMonetis" }] }),
  component: TransactionsRoute,
  validateSearch: validateTransactionsSearch,
});

function TransactionsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <TransactionsContainer
          onSearchChange={(nextSearch) =>
            navigate({
              replace: true,
              search: (previous) => ({ ...previous, ...nextSearch }),
            })
          }
          search={search}
        />
        <TransactionDeepLinkDialog
          onOpenChange={(open) => {
            if (!open) {
              navigate({
                replace: true,
                search: (previous) => ({ ...previous, edit: undefined }),
              });
            }
          }}
          transactionId={search.edit}
        />
      </main>
    </ProtectedRoute>
  );
}
