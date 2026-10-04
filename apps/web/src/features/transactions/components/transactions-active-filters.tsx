import {
  Banknote,
  CalendarClock,
  Circle,
  CircleCheck,
  CreditCard,
  Filter,
  Landmark,
  Paperclip,
  Search,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import { CategoryIcon } from "@/features/categories/category-icons";

import {
  type buildFilterSlugMap,
  formatTransactionFilterAmount,
  formatTransactionFilterDate,
  paymentMethodIcons,
  paymentMethodLabels,
  type TransactionsSearch,
  transactionConditionIcons,
  transactionConditionLabels,
  transactionTypeLabels,
} from "../transactions.presentation";
import { FilterChip } from "./transaction-filter-chip";
import { transactionTypeIcons } from "./transaction-type-badge";
import type { TransactionsFilterKey, TransactionsScreenProps } from "./transactions-screen.types";

export function TransactionsActiveFilters({
  accounts,
  cards,
  categories,
  people,
  onSearchChange,
  urlSearch,
  search,
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
  setSearch,
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
  search: string;
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
  setSearch: (value: string) => void;
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
    <>
      {activeFilterCount ? (
        <fieldset
          aria-label="Filtros ativos"
          className="grid min-w-0 gap-2.5 rounded-xl border border-border/60 bg-muted/50 px-3 py-2.5"
        >
          <div className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Filter aria-hidden="true" className="size-3.5 shrink-0" />
              Filtros ativos
            </span>
            <Button
              className="shrink-0 text-xs font-normal text-muted-foreground hover:bg-background hover:text-foreground"
              onClick={clearFilters}
              size="sm"
              type="button"
              variant="ghost"
            >
              Limpar filtros
            </Button>
          </div>
          <div className="flex min-w-0 flex-wrap gap-2">
            {search ? (
              <FilterChip icon={Search} label={`Busca: ${search}`} onRemove={() => setSearch("")} />
            ) : null}
            {!hiddenFilterSet.has("type") && typeFilter ? (
              <FilterChip
                icon={transactionTypeIcons[typeFilter]}
                label={`Tipo: ${transactionTypeLabels[typeFilter]}`}
                onRemove={() => setTypeFilter("all")}
              />
            ) : null}
            {conditionFilter ? (
              <FilterChip
                icon={transactionConditionIcons[conditionFilter]}
                label={`Condição: ${transactionConditionLabels[conditionFilter]}`}
                onRemove={() => setConditionFilter("all")}
              />
            ) : null}
            {!hiddenFilterSet.has("paymentMethod") && paymentMethodFilter ? (
              <FilterChip
                icon={paymentMethodIcons[paymentMethodFilter]}
                label={`Pagamento: ${paymentMethodLabels[paymentMethodFilter]}`}
                onRemove={() => setPaymentMethodFilter("all")}
              />
            ) : null}
            {!hiddenFilterSet.has("settlement") && settlementFilter ? (
              <FilterChip
                icon={
                  settlementFilter === "paid"
                    ? CircleCheck
                    : settlementFilter === "invoice"
                      ? CreditCard
                      : Circle
                }
                label={`Status: ${settlementFilter === "invoice" ? "Pagamento pela fatura" : settlementFilter === "paid" ? "Pagos / recebidos" : "Em aberto"}`}
                onRemove={() => setSettlementFilter("all")}
              />
            ) : null}
            {!hiddenFilterSet.has("person") &&
              personSlugs.map((slug) => (
                <FilterChip
                  key={`person-${slug}`}
                  imageSrc={
                    people.find((item) => peopleSlugMap.idToSlug.get(item.id) === slug)
                      ?.avatarUrl ?? null
                  }
                  icon={Users}
                  label={`Pessoa: ${people.find((person) => peopleSlugMap.idToSlug.get(person.id) === slug)?.name ?? "Pessoa"}`}
                  onRemove={() =>
                    setMultipleFilter(
                      "people",
                      personSlugs.filter((value) => value !== slug),
                    )
                  }
                />
              ))}
            {!hiddenFilterSet.has("category") &&
              categorySlugs.map((slug) => (
                <FilterChip
                  key={`category-${slug}`}
                  visual={
                    <CategoryIcon
                      className="size-4"
                      name={
                        categories.find((item) => categoriesSlugMap.idToSlug.get(item.id) === slug)
                          ?.icon ?? null
                      }
                    />
                  }
                  label={`Categoria: ${categories.find((category) => categoriesSlugMap.idToSlug.get(category.id) === slug)?.name ?? "Categoria"}`}
                  onRemove={() =>
                    setMultipleFilter(
                      "categories",
                      categorySlugs.filter((value) => value !== slug),
                    )
                  }
                />
              ))}
            {!hiddenFilterSet.has("accountCard") &&
              accountSlugs.map((slug) => (
                <FilterChip
                  key={`account-${slug}`}
                  imageSrc={
                    accounts.find((item) => accountsSlugMap.idToSlug.get(item.id) === slug)?.logo ??
                    null
                  }
                  icon={Landmark}
                  label={`Conta: ${accounts.find((account) => accountsSlugMap.idToSlug.get(account.id) === slug)?.name ?? "Conta"}`}
                  onRemove={() =>
                    setMultipleFilter(
                      "accounts",
                      accountSlugs.filter((value) => value !== slug),
                    )
                  }
                />
              ))}
            {!hiddenFilterSet.has("accountCard") &&
              cardSlugs.map((slug) => (
                <FilterChip
                  key={`card-${slug}`}
                  imageSrc={
                    cards.find((item) => cardsSlugMap.idToSlug.get(item.id) === slug)?.logo ?? null
                  }
                  icon={CreditCard}
                  label={`Cartão: ${cards.find((card) => cardsSlugMap.idToSlug.get(card.id) === slug)?.name ?? "Cartão"}`}
                  onRemove={() =>
                    setMultipleFilter(
                      "cards",
                      cardSlugs.filter((value) => value !== slug),
                    )
                  }
                />
              ))}
            {urlSearch.minAmount !== undefined || urlSearch.maxAmount !== undefined ? (
              <FilterChip
                icon={Banknote}
                label={`Valor: ${formatTransactionFilterAmount(urlSearch.minAmount ?? 0)} até ${urlSearch.maxAmount !== undefined ? formatTransactionFilterAmount(urlSearch.maxAmount) : "sem limite"}`}
                onRemove={() =>
                  onSearchChange({ minAmount: undefined, maxAmount: undefined, page: undefined })
                }
              />
            ) : null}
            {urlSearch.dateStart || urlSearch.dateEnd ? (
              <FilterChip
                icon={CalendarClock}
                label={`Datas: ${urlSearch.dateStart ? formatTransactionFilterDate(urlSearch.dateStart) : "início"} até ${urlSearch.dateEnd ? formatTransactionFilterDate(urlSearch.dateEnd) : "fim"}`}
                onRemove={() =>
                  onSearchChange({ dateStart: undefined, dateEnd: undefined, page: undefined })
                }
              />
            ) : null}
            {urlSearch.hasAttachments ? (
              <FilterChip
                icon={Paperclip}
                label="Com anexo"
                onRemove={() => onSearchChange({ hasAttachments: undefined, page: undefined })}
              />
            ) : null}
            {urlSearch.isDivided ? (
              <FilterChip
                icon={Users}
                label="Somente divididos"
                onRemove={() => onSearchChange({ isDivided: undefined, page: undefined })}
              />
            ) : null}
          </div>
        </fieldset>
      ) : null}
    </>
  );
}
