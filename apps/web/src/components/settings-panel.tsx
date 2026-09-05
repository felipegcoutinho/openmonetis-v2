import type { LucideIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function SettingsPanel({ className, ...props }: ComponentProps<typeof Card>) {
  return (
    <Card className={cn("gap-0 py-0 dark:ring-1 dark:ring-border/60", className)} {...props} />
  );
}

export function SettingsSection({
  children,
  className,
  contentClassName,
  description,
  icon: Icon,
  title,
  variant = "default",
}: {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  description: string;
  icon: LucideIcon;
  title: string;
  variant?: "default" | "destructive";
}) {
  return (
    <section
      className={cn(
        "grid border-border border-b last:border-b-0 lg:grid-cols-[minmax(13rem,0.34fr)_minmax(0,1fr)]",
        className,
      )}
    >
      <div className="flex items-start gap-3 px-5 pt-6 sm:px-6 lg:bg-muted/25 lg:py-6">
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-strong",
            variant === "destructive" && "bg-destructive/10 text-destructive",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div>
          <h2
            className={cn(
              "font-heading font-medium text-base",
              variant === "destructive" && "text-destructive",
            )}
          >
            {title}
          </h2>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      <div className={cn("min-w-0 px-5 pt-5 pb-6 sm:px-6 lg:py-6", contentClassName)}>
        {children}
      </div>
    </section>
  );
}
