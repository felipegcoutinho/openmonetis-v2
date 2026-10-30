import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { startPagePaths } from "@/features/preferences/preferences.presentation";
import { userPreferencesQueryOptions } from "@/features/preferences/preferences.queries";
import { authClient } from "@/lib/auth-client";

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  const preferences = useQuery(userPreferencesQueryOptions(Boolean(session.data)));

  if (session.isPending || (session.data && preferences.isPending)) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4 py-12">
        <p className="text-muted-foreground text-sm">Carregando...</p>
      </main>
    );
  }

  if (session.data) {
    return <Navigate to={startPagePaths[preferences.data?.startPage ?? "dashboard"]} replace />;
  }

  return children;
}
