import type { DashboardAttentionSeverity } from "@openmonetis/domain/dashboard";
import type { DashboardAttentionItemOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import {
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  CreditCard,
  Inbox,
  RefreshCw,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { noteKindIcons } from "@/features/notes/notes.presentation";
import { cn } from "@/lib/utils";
import {
  attentionActionLabels,
  formatAttentionDetail,
  getAttentionKindLabel,
  getAttentionTitle,
  hideDashboardWidget,
} from "../dashboard.presentation";
import { dashboardAttentionQueryOptions } from "../dashboard.queries";
import { useDashboardWidgetEditor } from "../useDashboardWidgetEditor";
import { DashboardWidgetMenu } from "./dashboard-widget-menu";

const collapsedItemCount = 4;
const TaskIcon = noteKindIcons.task;

const severityDotClassNames: Record<DashboardAttentionSeverity, string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

/** Due date or status line: tinted when it asks for action, neutral when it only informs. */
const severityDetailClassNames: Record<DashboardAttentionSeverity, string> = {
  critical: "font-medium text-destructive",
  warning: "text-warning",
  info: "text-muted-foreground",
};

/** Header badge and corner glow follow the most severe item, so red only appears when it is due. */
const severityToneClassNames: Record<DashboardAttentionSeverity, { badge: string; glow: string }> =
  {
    critical: {
      badge: "bg-destructive/10 text-destructive",
      glow: "bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--destructive)_9%,transparent),transparent_60%)]",
    },
    warning: {
      badge: "bg-warning/12 text-warning",
      glow: "bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklab,var(--warning)_9%,transparent),transparent_60%)]",
    },
    info: {
      badge: "bg-muted text-foreground",
      glow: "",
    },
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
  const editor = useDashboardWidgetEditor();
  const preferencesQuery = editor.preferencesQuery;
  const query = useQuery({
    ...dashboardAttentionQueryOptions(period),
    enabled: !preferencesQuery.data?.hidden.includes("attention"),
  });
  const [expanded, setExpanded] = useState(false);
  const items = query.data?.items ?? [];
  const visibleItems = expanded ? items : items.slice(0, collapsedItemCount);
  const hiddenCount = items.length - visibleItems.length;
  const hasPartialError = Boolean(query.data?.unavailableSources.length);
  // The API sorts items by urgency, so the first one carries the highest severity.
  const tone = severityToneClassNames[items[0]?.severity ?? "info"];

  if (preferencesQuery.data?.hidden.includes("attention")) return null;
  const menu = editor.canEdit ? (
    <DashboardWidgetMenu
      controls={{
        onRemove: () => editor.update((current) => hideDashboardWidget(current, "attention")),
        title: "Precisa de atenção",
      }}
    />
  ) : null;

  if (query.data && items.length === 0 && !hasPartialError) {
    return (
      <div className="flex min-h-11 items-center gap-2 rounded-card border bg-card py-1 pr-1 pl-4 text-muted-foreground text-sm">
        <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success" />
        <p className="min-w-0 flex-1">
          <span className="font-medium text-foreground">Precisa de atenção:</span> tudo em dia,
          nenhuma pendência neste mês.
        </p>
        {menu}
      </div>
    );
  }

  return (
    <Card
      aria-labelledby={`attention-${variant}-title`}
      // A faint glow from the top-left corner signals urgency without a loud border. It starts at
      // the border box and does not repeat, or a tiled copy shows as a seam under the translucent border.
      className={cn("gap-4 bg-origin-border bg-no-repeat p-5", tone.glow)}
      role="region"
    >
      <div className="flex items-center gap-2">
        <h2
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2.5 py-1 font-heading font-medium text-sm leading-normal",
            tone.badge,
          )}
          id={`attention-${variant}-title`}
        >
          {/* Filled circle: the "!" strokes take the background color to stay readable. */}
          <CircleAlert
            aria-hidden="true"
            className="size-3.5 shrink-0 fill-current [&_line]:text-background"
          />
          Precisa de atenção
          {items.length > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{items.length}</span>
            </>
          ) : null}
        </h2>
        <span className="ml-auto">{menu}</span>
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
          // Offsets the button padding so the label lines up with the tiles' edge.
          className="-ms-2.5 w-fit"
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
        {item.severity === "critical" ? (
          <span className="shrink-0 font-medium text-destructive">
            {severityLabels.critical}
            <span aria-hidden="true"> ·</span>
            <span className="sr-only">:</span>
          </span>
        ) : (
          <span className="sr-only">{severityLabels[item.severity]}:</span>
        )}
        <span className="truncate">{getAttentionKindLabel(item)}</span>
      </span>
      {/* Centered, not baseline: the title group starts with a logo, which has no text baseline. */}
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <AttentionItemVisual item={item} />
          <span className="truncate font-medium text-sm">{getAttentionTitle(item)}</span>
        </span>
        {item.amount !== null ? (
          <MoneyValue amount={item.amount} className="shrink-0 font-medium text-sm tabular-nums" />
        ) : null}
      </span>
      <span className="flex items-center justify-between gap-2 text-xs">
        <span className={cn("truncate", severityDetailClassNames[item.severity])}>
          {formatAttentionDetail(item)}
        </span>
        <span className="inline-flex shrink-0 items-center gap-0.5 font-medium text-muted-foreground transition-colors group-hover:text-brand-strong group-focus-visible:text-brand-strong">
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
        "group grid min-h-11 gap-1 rounded-md bg-[color-mix(in_oklab,var(--muted)_70%,var(--card))] p-3.5 transition-[background-color,scale] duration-150 ease-out hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100",
        variant === "band" && "h-full",
      )}
      item={item}
      period={period}
    >
      {content}
    </AttentionLink>
  );
}

function AttentionItemVisual({ item }: { item: DashboardAttentionItemOutput }) {
  if (item.kind === "invoice" && item.logo) {
    return (
      <Image
        alt=""
        className="size-5 shrink-0 rounded-full object-contain outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
        height={20}
        layout="fixed"
        src={item.logo}
        width={20}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center rounded-full bg-background text-muted-foreground"
    >
      {item.kind === "invoice" ? (
        <CreditCard className="size-3" />
      ) : item.kind === "task" ? (
        <TaskIcon className="size-3" />
      ) : item.kind === "inbox" ? (
        <Inbox className="size-3" />
      ) : (
        <CategoryIcon className="size-3" name={item.categoryIcon} />
      )}
    </span>
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
  if (item.kind === "task") {
    return (
      <Link className={className} to="/notes">
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
        rules: undefined,
        status: undefined,
      }}
      to="/inbox"
    >
      {children}
    </Link>
  );
}
