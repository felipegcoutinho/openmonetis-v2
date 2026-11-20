import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/navigation/app-shell";
import { PersonConnectionAcceptPage } from "@/features/person-connections/components/person-connection-accept-page";

export const Route = createFileRoute("/person-connections/accept")({
  head: () => ({ meta: [{ title: "Aceitar conexão · OpenMonetis" }] }),
  component: PersonConnectionAcceptRoute,
});

function PersonConnectionAcceptRoute() {
  return (
    <ProtectedRoute>
      <AppShell>
        <PersonConnectionAcceptPage />
      </AppShell>
    </ProtectedRoute>
  );
}
