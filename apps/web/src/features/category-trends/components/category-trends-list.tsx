import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Info, Minus } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { MoneyValue as BaseMoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCategoryLabel } from "@/features/categories/categories.presentation";
import { CategoryIcon } from "@/features/categories/category-icons";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";
import { formatTrendPercentage } from "../category-trends.presentation";

type CategoryTrendsListProps = {
  categories: CategoryTrendsOutput["categories"];
  periods: CategoryTrendsOutput["periods"];
  summary: CategoryTrendsOutput["summary"];
};

export function CategoryTrendsList({ categories, periods, summary }: CategoryTrendsListProps) {
  const expenses = categories.filter((category) => category.type === "expense");
  const incomes = categories.filter((category) => category.type === "income");

  return (
    <div className="grid gap-6">
      <CategorySection
        averageAmount={summary.averageMonthlyExpenseAmount}
        categories={expenses}
        periods={periods}
        totalAmount={summary.expenseAmount}
        type="expense"
      />
      <CategorySection
        averageAmount={summary.averageMonthlyIncomeAmount}
        categories={incomes}
        periods={periods}
        totalAmount={summary.incomeAmount}
        type="income"
      />
    </div>
  );
}

function CategorySection({
  averageAmount,
  categories,
  periods,
  totalAmount,
  type,
}: {
  averageAmount: number;
  categories: CategoryTrendsOutput["categories"];
  periods: CategoryTrendsOutput["periods"];
  totalAmount: number;
  type: "income" | "expense";
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [sortKey, setSortKey] = useState<"totalAmount" | "averageAmount" | null>(null);
  type Row = CategoryTrendsOutput["categories"][number] & {
    isDetail?: boolean;
    isDirect?: boolean;
    parentIcon?: string | null;
  };
  const sortedCategories = sortKey
    ? [...categories].sort((left, right) => right[sortKey] - left[sortKey])
    : categories;
  const rows: Row[] = sortedCategories.flatMap((category) => {
    if (!expandedIds.has(category.categoryId)) return [category];
    const details: Row[] = (category.subcategories ?? []).map((child) => ({
      ...child,
      isDetail: true,
      parentIcon: category.icon,
    }));
    if (
      category.directCategory?.values.some(
        (value) => value.totalAmount !== 0 || value.previousAmount !== 0,
      )
    )
      details.push({
        ...category.directCategory,
        isDetail: true,
        isDirect: true,
        parentIcon: category.icon,
      });
    return [category, ...details];
  });
  function toggleSort(key: "totalAmount" | "averageAmount") {
    setSortKey((current) => (current === key ? null : key));
  }
  function toggleGroup(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function identity(category: Row) {
    return (
      <>
        <span
          className={cn(
            "grid shrink-0 place-items-center rounded-full",
            category.isDetail
              ? "size-6 bg-muted-foreground text-muted"
              : "size-8 bg-muted text-muted-foreground",
          )}
        >
          <CategoryIcon
            className="size-4"
            name={category.isDetail ? category.parentIcon : category.icon}
          />
        </span>
        {category.isDirect ? (
          <span
            className="min-w-0 flex-1 whitespace-normal text-muted-foreground"
            title={`Lançamentos diretamente em ${category.name}`}
          >
            Sem subcategoria
          </span>
        ) : (
          <Link
            className={cn(
              "min-w-0 flex-1 truncate rounded-sm font-medium outline-none hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring",
              category.isDetail && "text-muted-foreground",
            )}
            title={getCategoryLabel(category)}
            to="/categories/$categoryId"
            params={{ categoryId: category.categoryId }}
            search={{ period: periods.at(-1)?.period }}
          >
            {category.isDetail ? category.name : getCategoryLabel(category)}
          </Link>
        )}
        {category.subcategories?.length ? (
          <Button
            className="shrink-0 gap-1 px-1.5 text-muted-foreground"
            type="button"
            size="sm"
            variant="ghost"
            aria-label={`${expandedIds.has(category.categoryId) ? "Recolher" : "Expandir"} subcategorias de ${category.name}`}
            aria-expanded={expandedIds.has(category.categoryId)}
            title={`${category.subcategories.length} ${category.subcategories.length === 1 ? "subcategoria" : "subcategorias"} · incluídas no total`}
            onClick={() => toggleGroup(category.categoryId)}
          >
            <span className="text-xs tabular-nums">{category.subcategories.length}</span>
            {expandedIds.has(category.categoryId) ? (
              <ChevronDown aria-hidden="true" className="size-3.5" />
            ) : (
              <ChevronRight aria-hidden="true" className="size-3.5" />
            )}
          </Button>
        ) : null}
      </>
    );
  }
  if (!categories.length) return null;

  const tableMinWidth = 288 + periods.length * 110 + 116 + 128;
  const latestPeriod = periods.at(-1)?.period;

  return (
    <section className="grid min-w-0 gap-3">
      <h2 className="font-semibold text-base">{type === "expense" ? "Despesas" : "Receitas"}</h2>
      <Card
        className="isolate hidden min-w-0 overflow-hidden py-0 xl:block"
        // Remount per range so the newest month starts visible beside the pinned totals.
        key={`${periods[0]?.period}-${latestPeriod}`}
        ref={revealLatestPeriod}
      >
        <Table className="table-fixed" style={{ minWidth: tableMinWidth }}>
          <colgroup>
            <col style={{ width: 288 }} />
            {periods.map((period) => (
              <col key={period.period} style={{ width: 110 }} />
            ))}
            <col style={{ width: 116 }} />
            <col style={{ width: 128 }} />
          </colgroup>
          <caption className="sr-only">
            Evolução mensal de {type === "expense" ? "despesas" : "receitas"} por categoria
          </caption>
          <TableHeader className="sticky top-0 z-20 bg-card">
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono sticky left-0 z-30 border-r bg-card px-5" scope="col">
                Categoria
              </TableHead>
              {periods.map((period) => (
                <TableHead
                  className={cn(
                    "overflow-hidden px-3 text-right text-xs",
                    period.period === latestPeriod && "bg-muted",
                  )}
                  key={period.period}
                  scope="col"
                >
                  {formatPeriod(period.period, true)}
                </TableHead>
              ))}
              <TableHead
                className="font-mono sticky right-[128px] z-30 overflow-hidden border-l bg-card px-4 text-right text-xs"
                aria-sort={sortKey === "averageAmount" ? "descending" : "none"}
                scope="col"
              >
                <span className="inline-flex items-center justify-end gap-1">
                  <SortButton
                    active={sortKey === "averageAmount"}
                    onClick={() => toggleSort("averageAmount")}
                  >
                    Média
                  </SortButton>
                  <Tooltip>
                    <TooltipTrigger
                      aria-label="Como a média é calculada"
                      render={<Button size="icon-xs" variant="ghost" />}
                    >
                      <Info aria-hidden="true" className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>Considera apenas os meses com movimento.</TooltipContent>
                  </Tooltip>
                </span>
              </TableHead>
              <TableHead
                className="font-mono sticky right-0 z-30 overflow-hidden bg-card px-4 text-right text-xs"
                aria-sort={sortKey === "totalAmount" ? "descending" : "none"}
                scope="col"
              >
                <SortButton
                  active={sortKey === "totalAmount"}
                  onClick={() => toggleSort("totalAmount")}
                >
                  Total
                </SortButton>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((category) => (
              <TableRow
                key={`${category.categoryId}-${category.isDirect ? "direct" : "category"}`}
                className={cn(
                  "group/row has-aria-expanded:bg-transparent has-aria-expanded:hover:bg-muted/50",
                  category.isDetail && "bg-muted/20 text-muted-foreground",
                )}
              >
                <th
                  className="sticky left-0 z-10 overflow-hidden border-r bg-card px-5 py-3 text-left align-middle font-normal whitespace-nowrap before:pointer-events-none before:absolute before:inset-0 group-hover/row:before:bg-primary/6"
                  scope="row"
                >
                  <div
                    className={cn(
                      "relative flex min-h-9 min-w-0 items-center gap-2.5",
                      category.isDetail && "ml-4 pl-3 text-sm",
                    )}
                  >
                    {identity(category)}
                  </div>
                </th>
                {category.values.map((value, index) => (
                  <TableCell
                    className={cn(
                      "overflow-hidden px-3 py-3 text-right",
                      value.period === latestPeriod && "bg-muted/30",
                    )}
                    key={value.period}
                  >
                    <TrendValueCell
                      detail={category.isDetail}
                      showChange={index > 0}
                      type={category.type}
                      value={value}
                    />
                  </TableCell>
                ))}
                <TableCell className="sticky right-[128px] z-10 overflow-hidden border-l bg-card px-4 py-3 text-right align-top">
                  <MoneyValue
                    amount={category.averageAmount}
                    className={cn(
                      "font-normal",
                      (category.isDetail || category.averageAmount === 0) &&
                        "text-muted-foreground",
                    )}
                  />
                </TableCell>
                <TableCell className="sticky right-0 z-10 overflow-hidden bg-card px-4 py-3 text-right align-top">
                  <MoneyValue
                    amount={category.totalAmount}
                    className={cn(
                      "font-normal",
                      (category.isDetail || category.totalAmount === 0) && "text-muted-foreground",
                    )}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <th
                className="sticky left-0 z-10 border-r bg-muted px-5 py-3 text-left font-medium"
                scope="row"
              >
                Total mensal
              </th>
              {periods.map((period) => (
                <TableCell
                  className={cn(
                    "overflow-hidden px-3 py-3 text-right",
                    period.period === latestPeriod && "bg-muted",
                  )}
                  key={period.period}
                >
                  <MoneyValue
                    amount={type === "expense" ? period.expenseAmount : period.incomeAmount}
                    className={cn(
                      "font-normal",
                      (type === "expense" ? period.expenseAmount : period.incomeAmount) === 0 &&
                        "text-muted-foreground",
                    )}
                  />
                </TableCell>
              ))}
              <TableCell className="sticky right-[128px] z-10 border-l bg-muted px-4 py-3 text-right">
                <MoneyValue amount={averageAmount} className="font-normal" />
              </TableCell>
              <TableCell className="sticky right-0 z-10 bg-muted px-4 py-3 text-right">
                <MoneyValue amount={totalAmount} className="font-normal" />
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <div className="grid gap-3 xl:hidden">
        {rows.map((category) => (
          <Card
            className={cn("gap-4", category.isDetail && "ml-4 text-muted-foreground")}
            key={`${category.categoryId}-${category.isDirect ? "direct" : "category"}`}
          >
            <CardHeader className="gap-3">
              <div className="grid min-w-0 gap-3">
                <div className="flex min-w-0 items-center gap-2">{identity(category)}</div>
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs">
                  <p className="text-muted-foreground">
                    Média <MoneyValue amount={category.averageAmount} />
                  </p>
                  <p className="text-muted-foreground">
                    Total{" "}
                    <MoneyValue
                      amount={category.totalAmount}
                      className="font-normal text-foreground"
                    />
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {category.values.map((value, index) => (
                <div
                  className={cn(
                    "grid min-w-0 gap-2 rounded-lg bg-muted/30 p-3 text-right",
                    value.period === latestPeriod && "bg-muted",
                  )}
                  key={value.period}
                >
                  <span className="text-muted-foreground text-xs">
                    {formatPeriod(value.period, true)}
                  </span>
                  <TrendValueCell
                    detail={category.isDetail}
                    showChange={index > 0}
                    type={category.type}
                    value={value}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function revealLatestPeriod(card: HTMLDivElement | null) {
  const container = card?.querySelector<HTMLElement>('[data-slot="table-container"]');
  if (container) container.scrollLeft = container.scrollWidth;
}

function SortButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      aria-label={`Ordenar por ${children}`}
      className={cn("gap-1 px-1.5", !active && "text-muted-foreground")}
      onClick={onClick}
      size="xs"
      type="button"
      variant="ghost"
    >
      {children}
      {active ? <ArrowDown aria-hidden="true" className="size-3" /> : null}
    </Button>
  );
}

function MoneyValue(props: ComponentProps<typeof BaseMoneyValue>) {
  if (props.amount === 0)
    return (
      <span className="text-muted-foreground">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Sem movimento</span>
      </span>
    );
  return <BaseMoneyValue {...props} />;
}

function TrendValueCell({
  detail,
  showChange,
  type,
  value,
}: {
  detail?: boolean;
  showChange: boolean;
  type: "income" | "expense";
  value: CategoryTrendsOutput["categories"][number]["values"][number];
}) {
  const changePositive = value.changeKind === "increase";
  const changeNegative = value.changeKind === "decrease";
  const favorable = type === "expense" ? changeNegative : changePositive;
  const unfavorable = type === "expense" ? changePositive : changeNegative;
  const ChangeIcon = changePositive ? ArrowUp : changeNegative ? ArrowDown : Minus;

  const noMovement =
    value.totalAmount === 0 &&
    value.previousAmount === 0 &&
    value.actualAmount === 0 &&
    value.recurringAmount === 0;

  if (!showChange || noMovement) {
    return (
      <div className="grid min-h-9 content-start justify-items-end gap-0.5">
        <MoneyValue
          amount={value.totalAmount}
          className={cn(
            "font-normal",
            (detail || value.totalAmount === 0) && "text-muted-foreground",
          )}
        />
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger className="ml-auto grid min-h-9 w-full content-start justify-items-end gap-0.5 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <MoneyValue
          amount={value.totalAmount}
          className={cn(
            "font-normal",
            (detail || value.totalAmount === 0) && "text-muted-foreground",
          )}
        />
        <span
          className={cn(
            "inline-flex max-w-full items-start justify-end gap-0.5 whitespace-normal text-right text-muted-foreground text-xs",
            favorable && "text-success",
            unfavorable && "text-destructive",
          )}
        >
          <ChangeIcon aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {formatTrendPercentage(value.changePercentage, value.changeKind)}
        </span>
      </TooltipTrigger>
      <TooltipContent className="grid min-w-48 gap-1.5" side="top">
        <span className="flex items-center justify-between gap-4">
          <span className="text-background">Período anterior</span>
          <MoneyValue amount={value.previousAmount} className="font-normal" />
        </span>
        <span className="flex items-center justify-between gap-4">
          <span className="text-background">Diferença</span>
          <MoneyValue
            amount={value.changeAmount}
            className={cn(
              "font-normal",
              favorable && "text-success",
              unfavorable && "text-destructive",
            )}
            showPositiveSign
          />
        </span>
        {value.recurringAmount > 0 ? (
          <span className="flex items-center justify-between gap-4">
            <span className="text-background">Recorrente</span>
            <MoneyValue amount={value.recurringAmount} className="font-normal" />
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
