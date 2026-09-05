import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { cn } from "@/lib/utils";

export type PageBreadcrumb = {
  label: string;
  href?: string;
};

type PageHeaderProps = {
  title?: string;
  description?: string;
  actions?: ReactNode;
  breadcrumbs?: PageBreadcrumb[];
  className?: string;
  eyebrow?: string;
  icon?: ReactNode;
};

export function PageHeader({
  actions,
  breadcrumbs,
  className,
  description,
  eyebrow,
  icon,
  title,
}: PageHeaderProps) {
  const breadcrumbItems = breadcrumbs ?? [];
  const hasBreadcrumbs = breadcrumbItems.length > 0;
  const hasContent = Boolean(title || description || actions || (!hasBreadcrumbs && eyebrow));

  return (
    <header className={cn("grid gap-3", className)}>
      {hasBreadcrumbs ? (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbItems.map((breadcrumb, index) => (
              <Fragment key={breadcrumb.label}>
                <BreadcrumbItem>
                  {breadcrumb.href ? (
                    <BreadcrumbLink render={<a href={breadcrumb.href} />}>
                      {breadcrumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <span>{breadcrumb.label}</span>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbItems.length - 1 ? <BreadcrumbSeparator /> : null}
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      ) : null}
      {hasContent ? (
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <div className="min-w-0">
            {!hasBreadcrumbs && eyebrow ? (
              <p className="mb-2 text-brand-strong text-xs uppercase tracking-tight">{eyebrow}</p>
            ) : null}
            {title ? (
              <div className="flex items-center gap-2.5">
                {icon ? <span className="shrink-0 text-brand-strong">{icon}</span> : null}
                <h1 className="font-heading text-3xl font-normal tracking-tight sm:text-4xl">
                  {title}
                </h1>
              </div>
            ) : null}
            {description ? (
              <p className="mt-2 max-w-2xl text-muted-foreground text-sm leading-relaxed">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="w-full **:data-[slot=button]:w-full sm:w-auto sm:**:data-[slot=button]:w-auto">
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
