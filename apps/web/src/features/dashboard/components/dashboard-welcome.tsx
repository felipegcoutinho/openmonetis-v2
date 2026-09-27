import { Skeleton } from "@/components/ui/skeleton";
import { formatDashboardDate, getDashboardGreeting } from "../dashboard.presentation";

export function DashboardWelcome({
  compactName = false,
  name,
}: {
  compactName?: boolean;
  name?: string | null;
}) {
  const displayName = name?.trim();
  const greetingName = compactName ? displayName?.split(/\s+/)[0] : displayName;

  return (
    <header className="space-y-1 md:space-y-2">
      {displayName ? (
        <h1 className="font-heading text-xl tracking-tight sm:text-3xl">
          <span className="text-muted-foreground" suppressHydrationWarning>
            {getDashboardGreeting()},
          </span>{" "}
          {greetingName}
        </h1>
      ) : (
        <div className="flex items-center gap-2">
          <h1
            className="font-heading text-xl tracking-tight text-muted-foreground sm:text-3xl"
            suppressHydrationWarning
          >
            {getDashboardGreeting()},
          </h1>
          <Skeleton className="h-7 w-48 sm:h-8" />
        </div>
      )}
      <p
        className="text-muted-foreground text-xs md:text-brand-strong md:uppercase"
        suppressHydrationWarning
      >
        {formatDashboardDate()}
      </p>
    </header>
  );
}
