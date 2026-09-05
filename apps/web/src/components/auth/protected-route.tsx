import { Navigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const session = authClient.useSession();

  if (!session.isPending && !session.data) {
    return <Navigate to="/" replace />;
  }

  return children;
}
