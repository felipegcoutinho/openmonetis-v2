import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiClientError } from "@/lib/api-client";

export function EntityLoadError({
  error,
  entity,
  onRetry,
  children,
}: {
  error: unknown;
  entity: string;
  onRetry: () => void;
  children: React.ReactNode;
}) {
  if (error instanceof ApiClientError && error.code?.toLowerCase().includes("not_found"))
    return children;
  return (
    <Card className="project-container my-6 items-center gap-3 p-6 text-center" role="alert">
      <h1 className="font-semibold">Não foi possível carregar {entity}</h1>
      <p className="text-muted-foreground text-sm">Verifique sua conexão e tente novamente.</p>
      <Button variant="outline" onClick={onRetry}>
        Tentar novamente
      </Button>
    </Card>
  );
}
