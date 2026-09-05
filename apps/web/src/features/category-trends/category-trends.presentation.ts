import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";

type CategoryTrendsSearch = {
  period?: string;
  startPeriod?: string;
  endPeriod?: string;
  categoryIds?: string;
};

const categoryTrendsPeriodOffset = 6;
const periodPattern = /^[1-9]\d{3}-(0[1-9]|1[0-2])$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validateCategoryTrendsSearch(
  search: Record<string, unknown>,
): CategoryTrendsSearch {
  const categoryIds = normalizeCategoryIds(search.categoryIds);

  return {
    period: validPeriod(search.period),
    startPeriod: validPeriod(search.startPeriod),
    endPeriod: validPeriod(search.endPeriod),
    categoryIds: categoryIds.length ? categoryIds.join(",") : undefined,
  };
}

export function resolveCategoryTrendsSearch(search: CategoryTrendsSearch) {
  const categoryIds = normalizeCategoryIds(search.categoryIds);
  const endPeriod = search.endPeriod ?? search.period;

  if (endPeriod) {
    return { ...getCategoryTrendsPeriodRange("end", endPeriod), categoryIds };
  }

  if (search.startPeriod) {
    return { ...getCategoryTrendsPeriodRange("start", search.startPeriod), categoryIds };
  }

  return {
    ...getCategoryTrendsPeriodRange("end", getCurrentPeriod()),
    categoryIds,
  };
}

function addMonthsToPeriod(period: string, months: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + months, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function formatTrendPeriod(period: string, short = false) {
  let label = formatDateInBrazil(periodToSafeInstant(period), {
    month: short ? "short" : "long",
    year: "numeric",
  }).replaceAll(".", "");
  if (short) label = label.replace(" de ", " ");
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}

export function getCategoryTrendsPeriodRange(anchor: "start" | "end", period: string) {
  return anchor === "start"
    ? { startPeriod: period, endPeriod: addMonthsToPeriod(period, categoryTrendsPeriodOffset) }
    : { startPeriod: addMonthsToPeriod(period, -categoryTrendsPeriodOffset), endPeriod: period };
}

export function formatTrendPercentage(value: number | null, kind: string) {
  if (kind === "started") return "Novo";
  if (value === null) return "Sem base";
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(value)}%`;
}

export function getCategoryTrendWidgetItems(
  categories: CategoryTrendsOutput["categories"],
  period: string,
  limit?: number,
) {
  const items = categories
    .filter((category) => category.type === "expense")
    .flatMap((category) => {
      const value = category.values.find((entry) => entry.period === period);
      return value && value.previousAmount > 0 && value.changePercentage !== null
        ? [{ category, value }]
        : [];
    })
    .sort(
      (left, right) =>
        Math.abs(right.value.changeAmount) - Math.abs(left.value.changeAmount) ||
        Math.abs(right.value.changePercentage ?? 0) - Math.abs(left.value.changePercentage ?? 0) ||
        left.category.name.localeCompare(right.category.name, "pt-BR"),
    );

  return limit === undefined ? items : items.slice(0, limit);
}

export function downloadCategoryTrendsCsv(report: CategoryTrendsOutput) {
  const rows = [
    ["Tipo", "Categoria", "Período", "Registrado", "Recorrente", "Total", "Variação"],
    ...report.categories.flatMap((category) =>
      category.values.map((value) => [
        category.type === "expense" ? "Despesa" : "Receita",
        category.name,
        value.period,
        formatCsvNumber(value.actualAmount),
        formatCsvNumber(value.recurringAmount),
        formatCsvNumber(value.totalAmount),
        value.changePercentage === null ? "" : String(value.changePercentage).replace(".", ","),
      ]),
    ),
  ];
  const content = `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `tendencias-${report.periods[0]?.period ?? "inicio"}-${report.periods.at(-1)?.period ?? "fim"}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function validPeriod(value: unknown) {
  return typeof value === "string" && periodPattern.test(value) ? value : undefined;
}

function normalizeCategoryIds(value: unknown) {
  if (typeof value !== "string") return [];
  const ids = [...new Set(value.split(",").filter((item) => uuidPattern.test(item)))];
  return ids.slice(0, 100);
}

export function getCurrentPeriod() {
  return getCurrentPeriodInBrazil();
}

function formatCsvNumber(value: number) {
  return value.toFixed(2).replace(".", ",");
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}
