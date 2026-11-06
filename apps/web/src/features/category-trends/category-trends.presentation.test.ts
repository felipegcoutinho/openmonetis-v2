import assert from "node:assert/strict";
import test from "node:test";
import type { CategoryTrendsOutput } from "@openmonetis/validators/category-trends";
import { categoryTrendsCsv } from "./category-trends.presentation";

function report(name: string): CategoryTrendsOutput {
  return {
    periods: [{ period: "2026-10" }] as CategoryTrendsOutput["periods"],
    categories: [
      {
        categoryId: "10000000-0000-4000-8000-000000000001",
        name,
        icon: null,
        type: "expense",
        totalAmount: 10.05,
        averageAmount: 10.05,
        values: [
          {
            period: "2026-10",
            actualAmount: 10.05,
            recurringAmount: 0,
            totalAmount: 10.05,
            previousAmount: 20,
            changeAmount: -9.95,
            changePercentage: -49.75,
            changeKind: "decrease",
          },
        ],
      },
    ],
    availableCategories: [],
    summary: {} as CategoryTrendsOutput["summary"],
  };
}

test("category trends CSV lists one row per category and month", () => {
  const csv = categoryTrendsCsv(report("Mercado"));
  assert.ok(csv.startsWith("﻿"));
  assert.match(csv, /^﻿"Tipo";"Categoria";"Período"/);
  assert.match(csv, /"Despesa";"Mercado";"2026-10";"10,05";"0,00";"10,05";"-49,75"/);
});

test("category names cannot inject spreadsheet formulas", () => {
  assert.match(categoryTrendsCsv(report('=HYPERLINK("https://example.test")')), /"'=HYPERLINK/);
  assert.match(categoryTrendsCsv(report("-2+3")), /"'-2\+3"/);
  assert.match(categoryTrendsCsv(report('Casa; "Aluguel"')), /"Casa; ""Aluguel"""/);
});
