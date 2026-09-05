import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
  return (
    <Card className={cn("h-115 gap-0 border py-0", className)}>
      <div className="border-b">
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {icon ? (
              <span className="grid size-7 shrink-0 place-items-center text-muted-foreground [&>svg]:size-4.5">
                {icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <CardTitle className="truncate text-sm leading-tight">{title}</CardTitle>
              {description ? (
                <CardDescription className="mt-0.5 text-xs leading-tight">
                  {description}
                </CardDescription>
              ) : null}
            </div>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </CardHeader>
      </div>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-2">
        {children}
      </CardContent>
      {footer ? <footer className="border-t px-5 py-3">{footer}</footer> : null}
    </Card>
  );
}
