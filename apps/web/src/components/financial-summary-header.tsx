import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLogoColors } from "@/hooks/useLogoColors";
import { cn } from "@/lib/utils";

type FinancialSummaryMetric = {
  description?: ReactNode;
  icon: ReactNode;
  key?: string;
  label: string;
  value: ReactNode;
};

type FinancialSummaryHeaderProps = {
  accentImage?: string | null;
  actions?: ReactNode;
  details?: ReactNode;
  eyebrow: string;
  identity: ReactNode;
  metrics: FinancialSummaryMetric[];
  primaryLabel?: string;
  primaryValue?: ReactNode;
  subtitle: ReactNode;
  title: string;
  variant?: "solid" | "soft";
};

export function FinancialSummaryHeader({
  accentImage,
  actions,
  details,
  eyebrow,
  identity,
  metrics,
  primaryLabel,
  primaryValue,
  subtitle,
  title,
  variant = "solid",
}: FinancialSummaryHeaderProps) {
  const logoColors = useLogoColors(accentImage);
  const hasPrimaryValue = primaryLabel !== undefined && primaryValue !== undefined;

  return (
    <Card
      className={cn(
        "overflow-hidden border-current/20 py-0 transition-colors duration-300",
        variant === "solid"
          ? "bg-primary text-primary-foreground"
          : "border-brand/25 bg-brand/15 text-foreground",
      )}
      style={
        logoColors
          ? ({
              backgroundColor: logoColors.backgroundColor,
              color: logoColors.foregroundColor,
            } satisfies CSSProperties)
          : undefined
      }
    >
      <CardContent className="p-0">
        <div className="p-6 sm:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              {identity}
              <div className="min-w-0">
                <p className="text-current/70 text-sm">{eyebrow}</p>
                <h2 className="truncate font-heading text-2xl font-normal">{title}</h2>
                <div className="mt-1 flex items-center gap-2 text-current/70 text-xs">
                  {subtitle}
                </div>
              </div>
            </div>
            {actions ? (
              <fieldset
                aria-label="Ações do resumo financeiro"
                className="m-0 flex min-w-0 shrink-0 flex-wrap items-center gap-2 border-0 p-0 sm:justify-end"
              >
                {actions}
              </fieldset>
            ) : null}
          </div>

          {hasPrimaryValue ? (
            <div className="mt-8">
              <p className="text-current/70 text-xs uppercase tracking-tight">{primaryLabel}</p>
              <div className="mt-2 font-heading text-4xl font-normal leading-none tracking-tight sm:text-5xl">
                {primaryValue}
              </div>
            </div>
          ) : null}
        </div>

        {metrics.length ? (
          <dl
            className={cn(
              "grid border-current/20 border-t",
              metrics.length === 2 ? "sm:grid-cols-2" : "sm:grid-cols-3",
            )}
          >
            {metrics.map((metric, index) => (
              <div
                className={cn(
                  "min-w-0 p-5 sm:p-6",
                  index > 0 && "border-current/20 border-t",
                  metrics.length === 2
                    ? index > 0 && "sm:border-t-0 sm:border-l"
                    : [index > 0 && index < 3 && "sm:border-t-0", index % 3 !== 0 && "sm:border-l"],
                )}
                key={metric.key ?? metric.label}
              >
                <dt className="flex items-center gap-1.5 text-current/70 text-xs">
                  {metric.icon}
                  {metric.label}
                </dt>
                <dd className="mt-2 truncate font-heading text-xl font-normal leading-none">
                  {metric.value}
                </dd>
                {metric.description ? (
                  <dd className="mt-2 text-current/70 text-xs leading-relaxed">
                    {metric.description}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        ) : null}

        {details ? <div className="border-current/20 border-t">{details}</div> : null}
      </CardContent>
    </Card>
  );
}

export function FinancialSummaryAction({
  className,
  size = "sm",
  variant = "ghost",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "rounded-full border-current/30 bg-transparent text-current shadow-none hover:border-current/70 hover:bg-transparent hover:text-current hover:underline focus-visible:border-current focus-visible:ring-current/30 aria-expanded:bg-transparent aria-expanded:text-current dark:hover:bg-transparent",
        className,
      )}
      size={size}
      variant={variant}
      {...props}
    />
  );
}
