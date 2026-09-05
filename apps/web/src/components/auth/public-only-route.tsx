import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const session = authClient.useSession();

  if (session.isPending) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 py-12">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </main>
    );
  }

  if (session.data) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
