import { Circle, CircleCheck, CreditCard, Filter } from "lucide-react";
import type { ReactNode } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileSheetContent as SheetContent } from "@/components/forms/mobile-sheet-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  getCategoryLabel,
  sortCategoryOptions,
} from "@/features/categories/categories.presentation";
import { TagsFilter } from "@/features/tags/components/tags-filter";
import {
  type buildFilterSlugMap,
  paymentMethodIcons,
  paymentMethodLabels,
  serializeFilterSlugs,
  type TransactionsSearch,
  transactionConditionIcons,
  transactionConditionLabels,
} from "../transactions.presentation";
import { numberValue } from "./transaction-filter-number";
import { FilterSelect } from "./transaction-filter-select";
import { FilterToggle } from "./transaction-filter-toggle";

import { MultiFilterSelect } from "./transaction-multi-filter-select";
import { transactionTypeIcons } from "./transaction-type-badge";
import type { TransactionsFilterKey, TransactionsScreenProps } from "./transactions-screen.types";

export function TransactionsFilters({
  accounts,
  cards,
  categories,
  people,
  onSearchChange,
  urlSearch,
  typeFilter,
  conditionFilter,
  paymentMethodFilter,
  settlementFilter,
  peopleSlugMap,
  categoriesSlugMap,
  accountsSlugMap,
  cardsSlugMap,
  personSlugs,
  categorySlugs,
  accountSlugs,
  cardSlugs,
  activeFilterCount,
  hiddenFilterSet,
  setTypeFilter,
  setConditionFilter,
  setPaymentMethodFilter,
  setSettlementFilter,
  clearFilters,
  setMultipleFilter,
}: {
  accounts: TransactionsScreenProps["accounts"];
  cards: TransactionsScreenProps["cards"];
  categories: TransactionsScreenProps["categories"];
  people: TransactionsScreenProps["people"];
  onSearchChange: TransactionsScreenProps["onSearchChange"];
  urlSearch: TransactionsSearch;
  typeFilter: TransactionsSearch["type"];
  conditionFilter: TransactionsSearch["condition"];
  paymentMethodFilter: TransactionsSearch["paymentMethod"];
  settlementFilter: TransactionsSearch["settlement"];
  peopleSlugMap: ReturnType<typeof buildFilterSlugMap>;
  categoriesSlugMap: ReturnType<typeof buildFilterSlugMap>;
  accountsSlugMap: ReturnType<typeof buildFilterSlugMap>;
  cardsSlugMap: ReturnType<typeof buildFilterSlugMap>;
  personSlugs: string[];
  categorySlugs: string[];
  accountSlugs: string[];
  cardSlugs: string[];
  activeFilterCount: number;
  hiddenFilterSet: Set<TransactionsFilterKey>;
  setTypeFilter: (value: string) => void;
  setConditionFilter: (value: string) => void;
  setPaymentMethodFilter: (value: string) => void;
  setSettlementFilter: (value: string) => void;
  clearFilters: () => void;
  setMultipleFilter: (
    key: "people" | "categories" | "accounts" | "cards",
    values: string[],
  ) => void;
}) {
  return (
    <div className="order-3 shrink-0 md:order-5">
      <Sheet>
        <SheetTrigger
          aria-label={
            activeFilterCount
              ? `Abrir filtros, ${activeFilterCount} ${activeFilterCount === 1 ? "ativo" : "ativos"}`
              : "Abrir filtros"
          }
          render={<Button className="relative bg-transparent" variant="outline" />}
        >
          <Filter aria-hidden="true" />
          <span className="hidden md:inline">Filtros</span>
          {activeFilterCount ? (
            <span
              aria-hidden="true"
              className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 font-medium text-2xs text-brand-foreground tabular-nums max-md:absolute max-md:-top-2 max-md:-right-2"
            >
              {activeFilterCount}
            </span>
          ) : null}
        </SheetTrigger>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Filtros
              {activeFilterCount ? (
                <Badge variant="secondary">
                  {activeFilterCount} {activeFilterCount === 1 ? "ativo" : "ativos"}
                </Badge>
              ) : null}
            </SheetTitle>
            <SheetDescription>
              A lista atualiza a cada escolha. Um intervalo de datas substitui o mês selecionado.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <div className="grid content-start gap-7">
              <FilterGroup title="Tipo e pagamento">
                {!hiddenFilterSet.has("type") ? (
                  <FilterSelect
                    label="Tipo de lançamento"
                    onChange={setTypeFilter}
                    options={[
                      { value: "all", label: "Todos" },
                      {
                        value: "income",
                        label: "Receitas",
                        icon: transactionTypeIcons.income,
                      },
                      {
                        value: "expense",
                        label: "Despesas",
                        icon: transactionTypeIcons.expense,
                      },
                      {
                        value: "transfer",
                        label: "Transferências",
                        icon: transactionTypeIcons.transfer,
                      },
                    ]}
                    value={typeFilter ?? "all"}
                  />
                ) : null}
                <FilterSelect
                  label="Condição"
                  onChange={setConditionFilter}
                  options={[
                    { value: "all", label: "Todos" },
                    {
                      value: "single",
                      label: transactionConditionLabels.single,
                      icon: transactionConditionIcons.single,
                    },
                    {
                      value: "installment",
                      label: "Parcelada",
                      icon: transactionConditionIcons.installment,
                    },
                    {
                      value: "recurring",
                      label: "Recorrente",
                      icon: transactionConditionIcons.recurring,
                    },
                  ]}
                  value={conditionFilter ?? "all"}
                />
                {!hiddenFilterSet.has("paymentMethod") ? (
                  <FilterSelect
                    label="Forma de pagamento"
                    onChange={setPaymentMethodFilter}
                    options={[
                      { value: "all", label: "Todas" },
                      ...Object.entries(paymentMethodLabels).map(([value, label]) => ({
                        value,
                        label,
                        icon: paymentMethodIcons[value as keyof typeof paymentMethodLabels],
                      })),
                    ]}
                    value={paymentMethodFilter ?? "all"}
                  />
                ) : null}
                {!hiddenFilterSet.has("settlement") ? (
                  <FilterSelect
                    label="Situação"
                    onChange={setSettlementFilter}
                    options={[
                      { value: "all", label: "Todos" },
                      { value: "paid", label: "Pagos / recebidos", icon: CircleCheck },
                      { value: "unpaid", label: "Em aberto", icon: Circle },
                      { value: "invoice", label: "Pagamento pela fatura", icon: CreditCard },
                    ]}
                    value={settlementFilter ?? "all"}
                  />
                ) : null}
              </FilterGroup>
              <FilterGroup title="Pessoas e contas">
                {!hiddenFilterSet.has("person") ? (
                  <MultiFilterSelect
                    label="Pessoa"
                    onChange={(values) => setMultipleFilter("people", values)}
                    options={people.flatMap((person) => {
                      const value = peopleSlugMap.idToSlug.get(person.id);
                      return value
                        ? [{ value, label: person.name, avatarUrl: person.avatarUrl }]
                        : [];
                    })}
                    selected={personSlugs}
                  />
                ) : null}
                {!hiddenFilterSet.has("category") ? (
                  <MultiFilterSelect
                    label="Categoria"
                    onChange={(values) => setMultipleFilter("categories", values)}
                    options={sortCategoryOptions(categories).flatMap((category) => {
                      const value = categoriesSlugMap.idToSlug.get(category.id);
                      return value
                        ? [
                            {
                              value,
                              label: getCategoryLabel(category),
                              group: category.type === "income" ? "Receitas" : "Despesas",
                              categoryIcon: category.icon,
                            },
                          ]
                        : [];
                    })}
                    selected={categorySlugs}
                  />
                ) : null}
                {!hiddenFilterSet.has("accountCard") ? (
                  <MultiFilterSelect
                    className="sm:col-span-2"
                    label="Conta/Cartão"
                    onChange={(values) => {
                      const nextAccountSlugs = values
                        .filter((value) => value.startsWith("account-"))
                        .map((value) => value.slice("account-".length));
                      const nextCardSlugs = values
                        .filter((value) => value.startsWith("card-"))
                        .map((value) => value.slice("card-".length));
                      onSearchChange({
                        accounts: serializeFilterSlugs(nextAccountSlugs),
                        cards: serializeFilterSlugs(nextCardSlugs),
                        page: undefined,
                      });
                    }}
                    options={[
                      ...accounts.flatMap((account) => {
                        const slug = accountsSlugMap.idToSlug.get(account.id);
                        return slug
                          ? [
                              {
                                value: `account-${slug}`,
                                label: account.name,
                                group: "Contas",
                                logoUrl: account.logo,
                              },
                            ]
                          : [];
                      }),
                      ...cards.flatMap((card) => {
                        const slug = cardsSlugMap.idToSlug.get(card.id);
                        return slug
                          ? [
                              {
                                value: `card-${slug}`,
                                label: card.name,
                                group: "Cartões",
                                logoUrl: card.logo,
                              },
                            ]
                          : [];
                      }),
                    ]}
                    selected={[
                      ...accountSlugs.map((slug) => `account-${slug}`),
                      ...cardSlugs.map((slug) => `card-${slug}`),
                    ]}
                  />
                ) : null}
                <TagsFilter search={urlSearch} onChange={onSearchChange} />
              </FilterGroup>
              <FilterGroup title="Datas e valores">
                <div className="grid gap-2 sm:col-span-2">
                  <span className="font-mono font-medium text-muted-foreground text-xs">
                    Intervalo de datas
                  </span>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DatePicker
                      onChange={(value) =>
                        onSearchChange({
                          dateStart: value || undefined,
                          dateEnd: value ? (urlSearch.dateEnd ?? value) : undefined,
                          page: undefined,
                        })
                      }
                      placeholder="Data inicial"
                      value={urlSearch.dateStart ?? ""}
                    />
                    <DatePicker
                      onChange={(value) =>
                        onSearchChange({
                          dateStart: value ? (urlSearch.dateStart ?? value) : undefined,
                          dateEnd: value || undefined,
                          page: undefined,
                        })
                      }
                      placeholder="Data final"
                      value={urlSearch.dateEnd ?? ""}
                    />
                  </div>
                </div>
                <div className="grid gap-2 sm:col-span-2">
                  <span className="font-mono font-medium text-muted-foreground text-xs">
                    Faixa de valor
                  </span>
                  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                    <Input
                      inputMode="decimal"
                      className="placeholder:text-muted-foreground"
                      min="0"
                      onChange={(event) =>
                        onSearchChange({
                          minAmount: numberValue(event.target.value),
                          page: undefined,
                        })
                      }
                      placeholder="Mínimo"
                      type="number"
                      value={urlSearch.minAmount ?? ""}
                    />
                    <span className="text-muted-foreground text-xs">até</span>
                    <Input
                      inputMode="decimal"
                      className="placeholder:text-muted-foreground"
                      min="0"
                      onChange={(event) =>
                        onSearchChange({
                          maxAmount: numberValue(event.target.value),
                          page: undefined,
                        })
                      }
                      placeholder="Máximo"
                      type="number"
                      value={urlSearch.maxAmount ?? ""}
                    />
                  </div>
                </div>
              </FilterGroup>
              <FilterGroup title="Outros">
                <FilterToggle
                  checked={Boolean(urlSearch.payables)}
                  label="Contas a pagar (com vencimento)"
                  onChange={(checked) =>
                    onSearchChange({ payables: checked ? true : undefined, page: undefined })
                  }
                />
                <FilterToggle
                  checked={Boolean(urlSearch.hasAttachments)}
                  label="Com anexo"
                  onChange={(checked) =>
                    onSearchChange({
                      hasAttachments: checked ? true : undefined,
                      page: undefined,
                    })
                  }
                />
                <FilterToggle
                  checked={Boolean(urlSearch.isDivided)}
                  label="Somente divididos"
                  onChange={(checked) =>
                    onSearchChange({ isDivided: checked ? true : undefined, page: undefined })
                  }
                />
              </FilterGroup>
            </div>
          </SheetBody>
          <SheetFooter>
            <Button disabled={!activeFilterCount} onClick={clearFilters} variant="outline">
              Limpar filtros
            </Button>
            <SheetClose render={<Button />}>Fechar</SheetClose>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-3 font-heading font-semibold text-sm">{title}</legend>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">{children}</div>
    </fieldset>
  );
}
