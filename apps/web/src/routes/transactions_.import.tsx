import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { TransactionImportContainer } from "@/features/transactions/components/transaction-import-container";

export const Route = createFileRoute("/transactions_/import")({
  component: TransactionImportRoute,
});

function TransactionImportRoute() {
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <TransactionImportContainer />
      </main>
    </ProtectedRoute>
  );
}
