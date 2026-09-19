import { Skeleton } from "@/components/ui/skeleton";
import { formatDashboardDate, getDashboardGreeting } from "../dashboard.presentation";

export function DashboardWelcome({ name }: { name?: string | null }) {
  const displayName = name?.trim();

  return (
    <header className="space-y-2 pt-1">
      {displayName ? (
        <h1 className="font-heading text-2xl font-medium tracking-tight sm:text-3xl">
          <span className="text-muted-foreground" suppressHydrationWarning>
            {getDashboardGreeting()},
          </span>{" "}
          {displayName}
        </h1>
      ) : (
        <div className="flex items-center gap-2">
          <h1
            className="font-heading text-2xl font-medium tracking-tight text-muted-foreground sm:text-3xl"
            suppressHydrationWarning
          >
            {getDashboardGreeting()},
          </h1>
          <Skeleton className="h-7 w-48 sm:h-8" />
        </div>
      )}
      <p className="text-brand-strong text-xs uppercase tracking-tight" suppressHydrationWarning>
        {formatDashboardDate()}
      </p>
    </header>
  );
}
