import type {
  CategoryTrendsOutput,
  ListCategoryTrendsQuery,
} from "@openmonetis/validators/category-trends";
import { Check, ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import {
  MobilePicker as Popover,
  MobilePickerContent as PopoverContent,
  MobilePickerTrigger as PopoverTrigger,
} from "@/components/forms/mobile-picker";
import { PeriodPicker } from "@/components/period-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryIcon } from "@/features/categories/category-icons";
import { getCategoryTrendsPeriodRange, getCurrentPeriod } from "../category-trends.presentation";

type CategoryTrendsFiltersProps = {
  categories: CategoryTrendsOutput["availableCategories"];
  filters: ListCategoryTrendsQuery;
  isFetching: boolean;
  onChange: (filters: ListCategoryTrendsQuery) => void;
};

export function CategoryTrendsFilters({
  categories,
  filters,
  isFetching,
  onChange,
}: CategoryTrendsFiltersProps) {
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);
  const [categorySearch, setCategorySearch] = useState("");
  const [draftCategoryIds, setDraftCategoryIds] = useState(filters.categoryIds);
  const normalizedSearch = categorySearch.trim().toLocaleLowerCase("pt-BR");
  const visibleCategories = categories.filter((category) =>
    category.name.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
  );
  const selectedIds = new Set(filters.categoryIds);
  const draftSelectedIds = new Set(draftCategoryIds);
  const selectedCategories = categories.filter((category) => selectedIds.has(category.categoryId));
  const categoryLabel =
    selectedCategories.length === 0
      ? "Todas as categorias"
      : selectedCategories.length === 1
        ? selectedCategories[0]?.name
        : `${selectedCategories.length} selecionadas`;
  const currentPeriod = getCurrentPeriod();
  const defaultPeriodRange = getCategoryTrendsPeriodRange("end", currentPeriod);
  const hasCustomFilters =
    filters.startPeriod !== defaultPeriodRange.startPeriod ||
    filters.endPeriod !== defaultPeriodRange.endPeriod ||
    filters.categoryIds.length > 0;

  function updatePeriod(field: "startPeriod" | "endPeriod", period: string) {
    onChange({
      ...filters,
      ...getCategoryTrendsPeriodRange(field === "startPeriod" ? "start" : "end", period),
    });
  }

  function changeCategoryFilterOpen(open: boolean) {
    if (open) {
      setCategorySearch("");
      setDraftCategoryIds(filters.categoryIds);
    }
    setCategoryFilterOpen(open);
  }

  function toggleCategory(categoryId: string) {
    setDraftCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId],
    );
  }

  function applyCategories() {
    onChange({ ...filters, categoryIds: draftCategoryIds });
    setCategoryFilterOpen(false);
  }

  function resetFilters() {
    onChange({
      ...defaultPeriodRange,
      categoryIds: [],
    });
  }

  return (
    <section
      aria-label="Filtros do relatório"
      className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end"
    >
      <div className="grid min-w-0 gap-1.5">
        <span className="font-medium text-muted-foreground text-xs">Período</span>
        <div className="grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end sm:gap-2">
          <div className="grid min-w-0 gap-1">
            <label className="text-muted-foreground text-xs" htmlFor="trend-start-period">
              De
            </label>
            <PeriodPicker
              className="min-w-0 w-full sm:w-48"
              id="trend-start-period"
              onChange={(period) => updatePeriod("startPeriod", period)}
              value={filters.startPeriod}
            />
          </div>
          <span aria-hidden="true" className="hidden pb-2 text-muted-foreground text-xs sm:block">
            até
          </span>
          <div className="grid min-w-0 gap-1">
            <label className="text-muted-foreground text-xs" htmlFor="trend-end-period">
              Até
            </label>
            <PeriodPicker
              className="min-w-0 w-full sm:w-48"
              id="trend-end-period"
              onChange={(period) => updatePeriod("endPeriod", period)}
              value={filters.endPeriod}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-1.5">
        <span className="font-medium text-muted-foreground text-xs">Categorias</span>
        <Popover onOpenChange={changeCategoryFilterOpen} open={categoryFilterOpen}>
          <PopoverTrigger
            render={
              <Button
                aria-label="Selecionar categorias"
                className="w-full justify-between font-normal sm:w-52"
                type="button"
                variant="outline"
              />
            }
          >
            <span className="truncate">{categoryLabel}</span>
            <ChevronDown aria-hidden="true" className="size-4 text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent
            title="Filtrar categorias"
            align="start"
            className="w-[min(22rem,calc(100vw-2rem))] p-0"
          >
            <div className="border-b p-3">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  aria-label="Buscar categoria"
                  className="pl-8"
                  onChange={(event) => setCategorySearch(event.target.value)}
                  placeholder="Buscar categoria"
                  value={categorySearch}
                />
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              <button
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
                onClick={() => setDraftCategoryIds([])}
                type="button"
              >
                <span className="grid size-5 place-items-center">
                  {draftCategoryIds.length === 0 ? <Check className="size-4" /> : null}
                </span>
                Todas as categorias
              </button>
              {visibleCategories.map((category) => (
                <div
                  className="flex items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent"
                  key={category.categoryId}
                >
                  <Checkbox
                    checked={draftSelectedIds.has(category.categoryId)}
                    id={`category-filter-${category.categoryId}`}
                    onCheckedChange={() => toggleCategory(category.categoryId)}
                  />
                  <label
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3"
                    htmlFor={`category-filter-${category.categoryId}`}
                  >
                    <CategoryIcon className="size-4 text-muted-foreground" name={category.icon} />
                    <span className="min-w-0 flex-1 truncate">{category.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {category.type === "expense" ? "Despesa" : "Receita"}
                    </span>
                  </label>
                </div>
              ))}
              {visibleCategories.length === 0 ? (
                <p className="px-2 py-8 text-center text-muted-foreground text-sm">
                  Nenhuma categoria encontrada.
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-between gap-3 border-t p-3">
              <span className="text-muted-foreground text-xs">
                {draftCategoryIds.length
                  ? `${draftCategoryIds.length} ${draftCategoryIds.length === 1 ? "selecionada" : "selecionadas"}`
                  : "Todas incluídas"}
              </span>
              <Button onClick={applyCategories} size="sm" type="button">
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {hasCustomFilters ? (
        <Button
          className="w-fit"
          disabled={isFetching}
          onClick={resetFilters}
          size="sm"
          type="button"
          variant="ghost"
        >
          Limpar filtros
        </Button>
      ) : null}
    </section>
  );
}
