import { Button } from "@/components/ui/button";

export function SettingsQueryError({
  message,
  onRetry,
  isRetrying = false,
}: {
  message: string;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <p className="text-sm">{message}</p>
      <Button disabled={isRetrying} onClick={onRetry} size="sm" type="button" variant="outline">
        {isRetrying ? "Tentando…" : "Tentar novamente"}
      </Button>
    </div>
  );
}
