import { ArrowUpDown, Search, X } from "lucide-react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { TransactionsSearch } from "../transactions.presentation";

import type { TransactionsScreenProps } from "./transactions-screen.types";
import { transactionSortLabels } from "./transactions-screen-options";

export function TransactionsSearchControls({
  urlSearch,
  onSearchChange,
  isMobile,
  search,
  setSearch,
}: {
  urlSearch: TransactionsSearch;
  onSearchChange: TransactionsScreenProps["onSearchChange"];
  isMobile: boolean | null;
  search: string;
  setSearch: (value: string) => void;
}) {
  return (
    <>
      <div className="order-2 flex shrink-0 items-center gap-2 text-muted-foreground text-sm md:order-3 md:ml-auto">
        <span className="hidden md:inline">Ordenar por</span>
        <Select
          value={urlSearch.sort ?? "recent"}
          onValueChange={(value) =>
            onSearchChange({ sort: value as TransactionsSearch["sort"], page: undefined })
          }
        >
          <SelectTrigger
            aria-label="Ordenar lançamentos"
            className="w-10 justify-center px-2 **:data-[slot=select-value]:hidden [&_svg:last-child]:hidden md:w-40 md:justify-between md:px-2.5 md:**:data-[slot=select-value]:flex md:[&_svg:last-child]:block"
          >
            <ArrowUpDown aria-hidden="true" className="md:hidden" />
            <SelectValue>{transactionSortLabels[urlSearch.sort ?? "recent"]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Mais recentes</SelectItem>
            <SelectItem value="oldest">Mais antigos</SelectItem>
            <SelectItem value="dueDate">Vencimento</SelectItem>
            <SelectItem value="amount">Maior valor</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="relative order-1 w-full md:order-4 md:w-64">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          aria-label="Buscar lançamentos"
          className="pr-9 pl-9 placeholder:text-muted-foreground"
          onChange={(event) => setSearch(event.target.value)}
          placeholder={isMobile === true ? "Buscar" : "Buscar descrição, pessoa ou categoria"}
          value={search}
        />
        {search ? (
          <button
            aria-label="Limpar busca"
            className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setSearch("")}
            type="button"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        ) : null}
      </div>
    </>
  );
}
