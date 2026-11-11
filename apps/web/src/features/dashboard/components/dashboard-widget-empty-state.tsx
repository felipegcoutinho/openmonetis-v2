import type { ReactNode } from "react";

type DashboardWidgetEmptyStateProps = {
  /** Hides the whole widget in the dashboard grid while it has nothing to show. */
  collapseWidget?: boolean;
  description: string;
  icon: ReactNode;
  title: string;
};

export function DashboardWidgetEmptyState({
  collapseWidget = false,
  description,
  icon,
  title,
}: DashboardWidgetEmptyStateProps) {
  return (
    <div
      className="grid flex-1 place-items-center py-6 text-center"
      data-dashboard-widget-collapse={collapseWidget ? "" : undefined}
    >
      <div className="max-w-xs fill-mode-both animate-in fade-in-0 duration-200">
        <span className="mx-auto grid size-10 place-items-center text-muted-foreground/70 [&>svg]:size-6 [&>svg]:stroke-[1.5]">
          {icon}
        </span>
        <p className="mt-2 font-medium text-sm">{title}</p>
        <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}
