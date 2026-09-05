import type { ReactNode } from "react";

type DashboardWidgetEmptyStateProps = {
  description: string;
  icon: ReactNode;
  title: string;
};

export function DashboardWidgetEmptyState({
  description,
  icon,
  title,
}: DashboardWidgetEmptyStateProps) {
  return (
    <div className="grid flex-1 place-items-center py-6 text-center">
      <div className="-translate-y-4 max-w-xs">
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-muted text-muted-foreground [&>svg]:size-5">
          {icon}
        </span>
        <p className="mt-3 font-medium text-sm">{title}</p>
        <p className="mt-1 line-clamp-1 text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}
