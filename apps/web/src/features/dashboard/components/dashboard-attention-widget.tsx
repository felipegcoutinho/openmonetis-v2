import type { DashboardAttentionSeverity } from "@openmonetis/domain/dashboard";
import type { DashboardAttentionItemOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronRight, RefreshCw } from "lucide-react";
import { type ReactNode, useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  attentionActionLabels,
  formatAttentionDetail,
  getAttentionKindLabel,
  getAttentionTitle,
} from "../dashboard.presentation";
import {
  dashboardAttentionQueryOptions,
  dashboardWidgetPreferencesQueryOptions,
} from "../dashboard.queries";

const collapsedItemCount = 4;

const severityDotClassNames: Record<DashboardAttentionSeverity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

const severityLabels: Record<DashboardAttentionSeverity, string> = {
  critical: "Urgente",
  warning: "Atenção",
  info: "Informativo",
};

export function DashboardAttentionWidget({
  period,
  variant = "list",
}: {
  period: string;
  variant?: "band" | "list";
}) {
  const preferencesQuery = useQuery(dashboardWidgetPreferencesQueryOptions());
  const query = useQuery({
    ...dashboardAttentionQueryOptions(period),
    enabled: !preferencesQuery.data?.hidden.includes("attention"),
  });
  const [expanded, setExpanded] = useState(false);
  const items = query.data?.items ?? [];
  const visibleItems = expanded ? items : items.slice(0, collapsedItemCount);
  const hiddenCount = items.length - visibleItems.length;
  const hasPartialError = Boolean(query.data?.unavailableSources.length);

  if (preferencesQuery.data?.hidden.includes("attention")) return null;

  return (
    <Card aria-labelledby={`attention-${variant}-title`} className="gap-3 border p-4" role="region">
      <div className="flex items-center gap-2">
        <h2 className="font-medium text-sm" id={`attention-${variant}-title`}>
          Precisa de atenção
        </h2>
        {items.length > 0 ? <Badge variant="secondary">{items.length}</Badge> : null}
        {variant === "band" && items.length > 0 ? (
          <span className="ml-auto text-muted-foreground text-xs">Ordenado por urgência</span>
        ) : null}
      </div>

      {query.isPending ? (
        <div aria-label="Carregando pendências" className="grid gap-2" role="status">
          <Skeleton className="h-20 w-full" />
        </div>
      ) : null}

      {query.isError ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-muted-foreground">Não foi possível verificar suas pendências.</p>
          <Button onClick={() => void query.refetch()} size="sm" type="button" variant="outline">
            <RefreshCw aria-hidden="true" />
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {query.data && items.length === 0 ? (
        <p className="flex items-center gap-2 text-muted-foreground text-sm">
          <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
          Tudo em dia. Nenhuma pendência neste mês.
        </p>
      ) : null}

      {visibleItems.length > 0 ? (
        <ul className={cn("grid gap-2", variant === "band" && "sm:grid-cols-2 xl:grid-cols-4")}>
          {visibleItems.map((item) => (
            <li className="min-w-0" key={item.id}>
              <AttentionItem item={item} period={period} variant={variant} />
            </li>
          ))}
        </ul>
      ) : null}

      {hiddenCount > 0 || expanded ? (
        <Button
          className="w-fit"
          onClick={() => setExpanded((value) => !value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {expanded ? "Mostrar menos" : `Ver mais ${hiddenCount}`}
        </Button>
      ) : null}

      {hasPartialError ? (
        <div className="flex items-center justify-between gap-3 text-muted-foreground text-xs">
          <span>Parte das pendências não foi carregada.</span>
          <Button onClick={() => void query.refetch()} size="xs" type="button" variant="ghost">
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function AttentionItem({
  item,
  period,
  variant,
}: {
  item: DashboardAttentionItemOutput;
  period: string;
  variant: "band" | "list";
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
        <span
          aria-hidden="true"
          className={cn("size-2 shrink-0 rounded-full", severityDotClassNames[item.severity])}
        />
        <span className="sr-only">{severityLabels[item.severity]}:</span>
        <span className="truncate">{getAttentionKindLabel(item)}</span>
      </span>
      <span className="flex min-w-0 items-baseline justify-between gap-2">
        <span className="truncate font-medium text-sm">{getAttentionTitle(item)}</span>
        {item.amount !== null ? (
          <MoneyValue amount={item.amount} className="shrink-0 font-medium text-sm" />
        ) : null}
      </span>
      <span className="flex items-center justify-between gap-2 text-xs">
        <span
          className={cn(
            "truncate",
            item.severity === "critical" ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {formatAttentionDetail(item)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-brand-strong">
          {attentionActionLabels[item.kind]}
          <ChevronRight
            aria-hidden="true"
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </>
  );

  return (
    <AttentionLink
      className={cn(
        "group grid min-h-11 gap-1 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        variant === "band" && "h-full",
      )}
      item={item}
      period={period}
    >
      {content}
    </AttentionLink>
  );
}

function AttentionLink({
  children,
  className,
  item,
  period,
}: {
  children: ReactNode;
  className: string;
  item: DashboardAttentionItemOutput;
  period: string;
}) {
  if (item.kind === "invoice" && item.referenceId) {
    return (
      <Link
        className={className}
        params={{ cardId: item.referenceId }}
        search={{ period: item.period ?? period }}
        to="/cards/$cardId"
      >
        {children}
      </Link>
    );
  }
  if (item.kind === "bill") {
    return (
      <Link
        className={className}
        search={{ payables: true, period, settlement: "unpaid", sort: "dueDate" }}
        to="/transactions"
      >
        {children}
      </Link>
    );
  }
  if (item.kind === "budget") {
    return (
      <Link className={className} search={{ period }} to="/budgets">
        {children}
      </Link>
    );
  }
  return (
    <Link
      className={className}
      search={{
        app: undefined,
        date: undefined,
        page: undefined,
        rule: undefined,
        status: undefined,
      }}
      to="/inbox"
    >
      {children}
    </Link>
  );
}
