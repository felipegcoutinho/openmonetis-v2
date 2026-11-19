import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { Fragment, type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useCompactPageTitleSource } from "@/hooks/useCompactPageTitle";
import { useIsMobile } from "@/hooks/useIsMobile";
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
  /**
   * The page's create action becomes a floating button above the bottom navigation on phones,
   * within reach of the thumb. Use only for a single primary "Novo …" action.
   */
  mobileFloatingAction?: boolean;
};

/** Top-level destinations live in the bottom navigation and menu; "back to overview" is noise. */
const overviewPath = "/dashboard";

export function PageHeader({
  actions,
  breadcrumbs,
  className,
  description,
  eyebrow,
  icon,
  mobileFloatingAction = false,
  title,
}: PageHeaderProps) {
  const isMobile = useIsMobile();
  const [heading, setHeading] = useState<HTMLHeadingElement | null>(null);
  useCompactPageTitleSource(isMobile ? title : undefined, heading);
  const breadcrumbItems = breadcrumbs ?? [];
  const hasBreadcrumbs = breadcrumbItems.length > 0;
  // On phones the full trail does not fit; a single link back to the nearest destination does.
  const backBreadcrumb = breadcrumbItems
    .slice(0, -1)
    .reverse()
    .find((breadcrumb) => breadcrumb.href);
  const mobileBackBreadcrumb = backBreadcrumb?.href !== overviewPath ? backBreadcrumb : undefined;
  const floatingAction = mobileFloatingAction && isMobile === true && actions;
  const hasContent = Boolean(title || description || actions || (!hasBreadcrumbs && eyebrow));

  return (
    <header
      data-mobile-page-header
      className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4", className)}
    >
      {mobileBackBreadcrumb?.href ? (
        <Link
          className="pressable -ml-2 -mb-2 inline-flex min-h-11 w-fit items-center gap-1 rounded-md pr-3 pl-1 text-muted-foreground text-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden"
          to={mobileBackBreadcrumb.href as never}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
          {mobileBackBreadcrumb.label}
        </Link>
      ) : null}
      {hasBreadcrumbs ? (
        <Breadcrumb className="min-w-0 max-w-full max-md:hidden">
          <BreadcrumbList className="min-w-0 max-w-full">
            {breadcrumbItems.map((breadcrumb, index) => (
              <Fragment key={breadcrumb.label}>
                <BreadcrumbItem className="max-md:shrink-0">
                  {breadcrumb.href ? (
                    <BreadcrumbLink render={<Link to={breadcrumb.href as never} />}>
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
                <h1 className="page-title" ref={setHeading}>
                  {title}
                </h1>
              </div>
            ) : null}
            {description ? (
              // Phones keep the gist; the content, not the intro, should own the first screen.
              <p className="mt-2 max-w-2xl text-muted-foreground leading-relaxed max-md:mt-1.5 max-md:line-clamp-2 max-md:text-sm">
                {description}
              </p>
            ) : null}
          </div>
          {actions && !floatingAction ? (
            <div
              className={cn(
                "w-full **:data-[slot=button]:w-full sm:w-auto sm:**:data-[slot=button]:w-auto",
                // Until the client knows the viewport, keep the floating action out of the header.
                mobileFloatingAction && "max-md:hidden",
              )}
            >
              {actions}
            </div>
          ) : null}
        </div>
      ) : null}
      {floatingAction
        ? createPortal(<div className="mobile-fab">{actions}</div>, document.body)
        : null}
    </header>
  );
}
