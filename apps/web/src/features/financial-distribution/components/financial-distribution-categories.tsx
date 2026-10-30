import type { FinancialDistributionOutput } from "@openmonetis/validators/financial-distribution";
import { Link } from "@tanstack/react-router";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import { distributionCategoryLabel } from "../financial-distribution.presentation";
import { FinancialDistributionPercentage } from "./financial-distribution-percentage";

type Category = FinancialDistributionOutput["categories"][number];
type Props = {
  categories: Category[];
  type: "income" | "expense";
  total: number;
  period: string;
  personScope: string;
  colors: ReadonlyMap<string, string>;
};

function ProportionBar({
  value,
  detail,
  type,
}: {
  value: number | null;
  detail: boolean;
  type: "income" | "expense";
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  if (value === null || isPrivacyModeEnabled) return null;
  return (
    <Progress
      aria-hidden="true"
      className="w-full"
      indicatorClassName={
        detail
          ? "bg-muted-foreground/60"
          : type === "expense"
            ? "bg-destructive/70"
            : "bg-success/70"
      }
      trackClassName="h-1"
      value={Math.min(100, Math.max(0, value))}
    />
  );
}

export function FinancialDistributionCategories({
  categories,
  type,
  total,
  period,
  personScope,
  colors,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const expandableKeys = categories.filter((c) => c.children.length > 0).map((c) => c.key);
  const allExpanded = expandableKeys.length > 0 && expandableKeys.every((k) => expanded.has(k));
  const toggle = (key: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const rows = categories.flatMap((category) => [
    { ...category, detail: false },
    ...(expanded.has(category.key)
      ? [
          ...(category.directAmount !== 0
            ? [
                {
                  ...category,
                  key: `${category.key}-direct`,
                  name: "Sem subcategoria",
                  amount: category.directAmount,
                  percentage: null,
                  children: [],
                  detail: true,
                  direct: true,
                },
              ]
            : []),
          ...category.children.map((child) => ({ ...child, children: [], detail: true })),
        ]
      : []),
  ]);
  const identity = (row: (typeof rows)[number]) => (
    <div
      className={cn("flex min-w-0 items-center gap-2", row.detail && "pl-5 text-muted-foreground")}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full",
          row.detail
            ? "size-6 bg-muted-foreground text-muted"
            : "size-8 bg-muted text-muted-foreground",
        )}
      >
        <CategoryIcon name={row.icon} className="size-4" />
      </span>
      {!row.detail && colors.has(row.key) ? (
        <ChartLegendMarker color={colors.get(row.key)} />
      ) : null}
      {row.categoryId && !("direct" in row) ? (
        <Link
          className="min-w-0 flex-1 truncate rounded-sm font-medium hover:text-brand-strong focus-visible:ring-2 focus-visible:ring-ring"
          title={distributionCategoryLabel(row)}
          onClick={(event) => event.stopPropagation()}
          to="/categories/$categoryId"
          params={{ categoryId: row.categoryId }}
          search={{ period, personScope }}
        >
          {distributionCategoryLabel(row)}
        </Link>
      ) : (
        <span className="min-w-0 flex-1 truncate">{distributionCategoryLabel(row)}</span>
      )}
      {row.children.length ? (
        <Button
          aria-label={`${expanded.has(row.key) ? "Recolher" : "Expandir"} subcategorias de ${row.name}`}
          aria-expanded={expanded.has(row.key)}
          className="shrink-0 gap-1 px-1.5 text-muted-foreground"
          size="sm"
          type="button"
          variant="ghost"
          onClick={(event) => {
            event.stopPropagation();
            toggle(row.key);
          }}
        >
          <span className="text-xs tabular-nums">{row.children.length}</span>
          {expanded.has(row.key) ? (
            <ChevronDown aria-hidden="true" />
          ) : (
            <ChevronRight aria-hidden="true" />
          )}
        </Button>
      ) : null}
    </div>
  );
  return (
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <CardHeader className="gap-4 border-b py-5">
        <div className="grid gap-1">
          <CardTitle>
            <h2>{type === "expense" ? "Despesas por categoria" : "Receitas por categoria"}</h2>
          </CardTitle>
          <CardDescription>
            {type === "expense"
              ? "Onde os gastos do mês se concentram."
              : "De onde vieram as receitas do mês."}
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <dl className="grid gap-1">
            <dt className="text-muted-foreground text-xs">
              Total de {type === "expense" ? "despesas" : "receitas"}
            </dt>
            <dd>
              <MoneyValue amount={total} className="kpi-value text-2xl" />
            </dd>
          </dl>
          <div className="flex items-center gap-3">
            {expandableKeys.length ? (
              <Button
                className="text-muted-foreground"
                size="sm"
                type="button"
                variant="ghost"
                onClick={() => setExpanded(allExpanded ? new Set() : new Set(expandableKeys))}
              >
                {allExpanded ? "Recolher tudo" : "Expandir tudo"}
              </Button>
            ) : null}
            <span className="text-muted-foreground text-xs">
              {categories.length} {categories.length === 1 ? "categoria" : "categorias"}
            </span>
          </div>
        </div>
      </CardHeader>
      {!rows.length ? (
        <CardContent className="py-6 text-muted-foreground text-sm">
          Nenhuma {type === "expense" ? "despesa" : "receita"} neste recorte.
        </CardContent>
      ) : (
        <>
          <div className="hidden sm:block">
            <Table>
              <caption className="sr-only">
                {type === "expense" ? "Despesas" : "Receitas"} por categoria. As subcategorias já
                estão incluídas no total da categoria.
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6" scope="col">
                    Categoria
                  </TableHead>
                  <TableHead className="text-right" scope="col">
                    Valor
                  </TableHead>
                  <TableHead className="pr-6 text-right" scope="col">
                    % das {type === "expense" ? "despesas" : "receitas"}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.key}
                    className={cn(
                      row.detail && "bg-muted/20",
                      row.children.length > 0 && "cursor-pointer",
                    )}
                    onClick={row.children.length > 0 ? () => toggle(row.key) : undefined}
                  >
                    <TableCell className="max-w-64 py-3 pl-6">{identity(row)}</TableCell>
                    <TableCell className="text-right">
                      <MoneyValue amount={row.amount} />
                    </TableCell>
                    <TableCell className="pr-6 text-right">
                      <div className="ml-auto grid w-28 justify-items-end gap-1.5">
                        <FinancialDistributionPercentage value={row.percentage} />
                        <ProportionBar value={row.percentage} detail={row.detail} type={type} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="divide-y sm:hidden">
            {rows.map((row) => (
              <div
                key={row.key}
                className={cn("grid gap-2 px-6 py-4", row.detail && "bg-muted/20")}
              >
                {identity(row)}
                <div className="grid gap-2 pl-9">
                  <ProportionBar value={row.percentage} detail={row.detail} type={type} />
                  <div className="flex items-center justify-between gap-3">
                    <MoneyValue amount={row.amount} />
                    <span className="text-muted-foreground text-xs">
                      <FinancialDistributionPercentage value={row.percentage} /> das{" "}
                      {type === "expense" ? "despesas" : "receitas"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {categories.some((category) => category.children.length > 0) ? (
        <p className="border-t px-6 py-4 text-muted-foreground text-xs">
          Expanda as categorias para ver as subcategorias, já incluídas no total.
        </p>
      ) : null}
    </Card>
  );
}
