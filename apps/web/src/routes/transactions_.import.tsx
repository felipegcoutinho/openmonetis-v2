import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/navigation/app-shell";
import { TransactionImportContainer } from "@/features/transactions/components/transaction-import-container";

export const Route = createFileRoute("/transactions_/import")({
  head: () => ({ meta: [{ title: "Importar lançamentos · OpenMonetis" }] }),
  component: TransactionImportRoute,
});

function TransactionImportRoute() {
  return (
    <ProtectedRoute>
      <AppShell>
        <TransactionImportContainer />
      </AppShell>
    </ProtectedRoute>
  );
}
