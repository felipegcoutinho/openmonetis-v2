import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DashboardWidgetMenu, useDashboardWidgetControls } from "./dashboard-widget-menu";

type DashboardWidgetProps = {
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: string;
  footer?: ReactNode;
  icon?: ReactNode;
  title: string;
};

export function DashboardWidget({
  action,
  children,
  className,
  description,
  footer,
  icon,
  title,
}: DashboardWidgetProps) {
  const controls = useDashboardWidgetControls();

  return (
    <Card className={cn("h-115 gap-0 py-0", className)}>
      <div className="mx-5 border-b border-dotted border-muted-foreground/40">
        <CardHeader className="flex flex-row items-start justify-between gap-3 px-0 pt-5 pb-3">
          <div className="min-w-0">
            <CardTitle className="flex min-w-0 items-center gap-2 text-[0.9375rem]">
              {icon ? (
                <span className="grid size-4 shrink-0 place-items-center text-muted-foreground [&>svg]:size-4">
                  {icon}
                </span>
              ) : null}
              <span className="truncate">{title}</span>
            </CardTitle>
            {description ? (
              <CardDescription className="mt-1 text-xs leading-tight">
                {description}
              </CardDescription>
            ) : null}
          </div>
          {action || controls ? (
            <div className="-mt-1 -mr-1.5 flex shrink-0 items-center gap-1">
              {action}
              {controls ? <DashboardWidgetMenu controls={controls} /> : null}
            </div>
          ) : null}
        </CardHeader>
      </div>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-2">
        {children}
      </CardContent>
      {footer ? (
        <footer className="mx-5 border-t border-dotted border-muted-foreground/40 py-3">
          {footer}
        </footer>
      ) : null}
    </Card>
  );
}
