import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { ArrowDown, ArrowUp, Minus, Repeat2 } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import { formatTrendPercentage, formatTrendPeriod } from "../category-trends.presentation";

type CategoryTrendsListProps = {
  categories: CategoryTrendsOutput["categories"];
  periods: CategoryTrendsOutput["periods"];
};

export function CategoryTrendsList({ categories, periods }: CategoryTrendsListProps) {
  const expenses = categories.filter((category) => category.type === "expense");
  const incomes = categories.filter((category) => category.type === "income");

  return (
    <div className="grid gap-6">
      <CategorySection categories={expenses} periods={periods} type="expense" />
      <CategorySection categories={incomes} periods={periods} type="income" />
    </div>
  );
}

function CategorySection({
  categories,
  periods,
  type,
}: {
  categories: CategoryTrendsOutput["categories"];
  periods: CategoryTrendsOutput["periods"];
  type: "income" | "expense";
}) {
  if (!categories.length) return null;

  return (
    <section className="grid gap-3">
      <h2 className="font-semibold text-base">{type === "expense" ? "Despesas" : "Receitas"}</h2>
      <Card className="hidden overflow-hidden py-0 md:block [&_[data-slot=table-container]]:overflow-x-hidden">
        <Table className="table-fixed">
          <colgroup>
            <col style={{ width: "18%" }} />
            {periods.map((period) => (
              <col key={period.period} style={{ width: `${62 / periods.length}%` }} />
            ))}
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-card px-4">Categoria</TableHead>
              {periods.map((period) => (
                <TableHead
                  className="overflow-hidden text-ellipsis px-1 text-right"
                  key={period.period}
                >
                  {formatTrendPeriod(period.period, true)}
                </TableHead>
              ))}
              <TableHead className="overflow-hidden px-1 text-right">Média</TableHead>
              <TableHead className="overflow-hidden pr-4 text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category) => (
              <TableRow key={category.categoryId}>
                <TableCell className="sticky left-0 z-10 overflow-hidden bg-card px-4 shadow-[1px_0_0_var(--border)]">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                      <CategoryIcon className="size-4" name={category.icon} />
                    </span>
                    <span className="min-w-0 truncate font-medium">{category.name}</span>
                  </div>
                </TableCell>
                {category.values.map((value, index) => (
                  <TableCell className="overflow-hidden px-1 text-right" key={value.period}>
                    <TrendValueCell showChange={index > 0} type={category.type} value={value} />
                  </TableCell>
                ))}
                <TableCell className="overflow-hidden px-1 text-right">
                  <MoneyValue amount={category.averageAmount} className="font-medium text-info" />
                </TableCell>
                <TableCell className="overflow-hidden pr-4 text-right">
                  <MoneyValue amount={category.totalAmount} className="font-semibold" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell className="sticky left-0 bg-muted px-4 font-medium">Total</TableCell>
              {periods.map((period) => (
                <TableCell className="overflow-hidden px-1 text-right" key={period.period}>
                  <MoneyValue
                    amount={type === "expense" ? period.expenseAmount : period.incomeAmount}
                    className="font-medium"
                  />
                </TableCell>
              ))}
              <TableCell />
              <TableCell />
            </TableRow>
          </TableFooter>
        </Table>
      </Card>

      <div className="grid gap-3 md:hidden">
        {categories.map((category) => (
          <Card className="gap-4" key={category.categoryId}>
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                  <CategoryIcon className="size-4" name={category.icon} />
                </span>
                <div className="min-w-0">
                  <CardTitle className="truncate">{category.name}</CardTitle>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    Média <MoneyValue amount={category.averageAmount} />
                  </p>
                </div>
              </div>
              <MoneyValue amount={category.totalAmount} className="shrink-0 font-semibold" />
            </CardHeader>
            <CardContent className="-mx-1 overflow-x-auto px-1 pb-1">
              <div className="flex min-w-max gap-2">
                {category.values.map((value, index) => (
                  <div
                    className="grid min-w-36 gap-2 rounded-lg border bg-muted/30 p-3"
                    key={value.period}
                  >
                    <span className="text-muted-foreground text-xs">
                      {formatTrendPeriod(value.period, true)}
                    </span>
                    <TrendValueCell showChange={index > 0} type={category.type} value={value} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function TrendValueCell({
  showChange,
  type,
  value,
}: {
  showChange: boolean;
  type: "income" | "expense";
  value: CategoryTrendsOutput["categories"][number]["values"][number];
}) {
  const changePositive = value.changeKind === "increase";
  const changeNegative = value.changeKind === "decrease";
  const favorable = type === "expense" ? changeNegative : changePositive;
  const unfavorable = type === "expense" ? changePositive : changeNegative;
  const ChangeIcon = changePositive ? ArrowUp : changeNegative ? ArrowDown : Minus;

  if (!showChange) {
    return <MoneyValue amount={value.totalAmount} className="font-medium" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger className="ml-auto grid w-fit justify-items-end gap-0.5">
        <MoneyValue amount={value.totalAmount} className="font-medium" />
        <span
          className={cn(
            "inline-flex items-center gap-0.5 text-muted-foreground text-xs",
            favorable && "text-success",
            unfavorable && "text-destructive",
          )}
        >
          <ChangeIcon aria-hidden="true" className="size-3" />
          {formatTrendPercentage(value.changePercentage, value.changeKind)}
          {value.recurringAmount > 0 ? (
            <Repeat2 aria-label="Inclui recorrência" className="ml-1 size-3" />
          ) : null}
        </span>
      </TooltipTrigger>
      <TooltipContent className="grid min-w-48 gap-1.5" side="top">
        <span className="flex items-center justify-between gap-4">
          <span className="text-background">Período anterior</span>
          <MoneyValue amount={value.previousAmount} className="font-semibold" />
        </span>
        <span className="flex items-center justify-between gap-4">
          <span className="text-background">Diferença</span>
          <MoneyValue
            amount={value.changeAmount}
            className={cn(
              "font-semibold",
              favorable && "text-success",
              unfavorable && "text-destructive",
            )}
            showPositiveSign
          />
        </span>
        {value.recurringAmount > 0 ? (
          <span className="flex items-center justify-between gap-4">
            <span className="text-background">Recorrente</span>
            <MoneyValue amount={value.recurringAmount} className="font-semibold" />
          </span>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}
