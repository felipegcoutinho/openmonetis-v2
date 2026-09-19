import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { Navbar } from "@/components/navigation/navbar";
import { PersonConnectionAcceptPage } from "@/features/person-connections/components/person-connection-accept-page";

export const Route = createFileRoute("/person-connections/accept")({
  head: () => ({ meta: [{ title: "Aceitar conexão · OpenMonetis" }] }),
  component: PersonConnectionAcceptRoute,
});

function PersonConnectionAcceptRoute() {
  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <PersonConnectionAcceptPage />
      </main>
    </ProtectedRoute>
  );
}
