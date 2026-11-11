import { ChevronLeft } from "lucide-react";
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
  description?: ReactNode;
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
  // On phones the full trail does not fit; a single link back to the nearest destination does.
  const backBreadcrumb = breadcrumbItems
    .slice(0, -1)
    .reverse()
    .find((breadcrumb) => breadcrumb.href);
  const hasContent = Boolean(title || description || actions || (!hasBreadcrumbs && eyebrow));

  return (
    <header
      data-mobile-page-header
      className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4", className)}
    >
      {backBreadcrumb?.href ? (
        <a
          className="-ml-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-md pr-2 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
          href={backBreadcrumb.href}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {backBreadcrumb.label}
        </a>
      ) : null}
      {hasBreadcrumbs ? (
        <Breadcrumb className={cn("min-w-0 max-w-full", backBreadcrumb?.href && "max-md:hidden")}>
          <BreadcrumbList className="min-w-0 max-w-full">
            {breadcrumbItems.map((breadcrumb, index) => (
              <Fragment key={breadcrumb.label}>
                <BreadcrumbItem className="max-md:shrink-0">
                  {breadcrumb.href ? (
                    <BreadcrumbLink render={<a href={breadcrumb.href} />}>
                      {breadcrumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <span
                      aria-current={index === breadcrumbItems.length - 1 ? "page" : undefined}
                      className={
                        index === breadcrumbItems.length - 1 ? "text-foreground" : undefined
                      }
                    >
                      {breadcrumb.label}
                    </span>
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
              <p className="eyebrow mb-2 text-brand-strong">{eyebrow}</p>
            ) : null}
            {title ? (
              <div className="flex items-center gap-2.5">
                {icon ? <span className="shrink-0 text-brand-strong">{icon}</span> : null}
                <h1 className="page-title">{title}</h1>
              </div>
            ) : null}
            {description ? (
              <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed">{description}</p>
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
