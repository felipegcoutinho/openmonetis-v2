import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Button } from "@/components/ui/button";

import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { TransactionsTableProps } from "./transactions-table.types";

export function TransactionsPagination({
  totalItems,
  currentPage,
  pageCount,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: TransactionsTableProps["totalItems"];
  currentPage: TransactionsTableProps["currentPage"];
  pageCount: TransactionsTableProps["pageCount"];
  pageSize: TransactionsTableProps["pageSize"];
  onPageChange: TransactionsTableProps["onPageChange"];
  onPageSizeChange: TransactionsTableProps["onPageSizeChange"];
}) {
  return (
    <div className="mt-3 flex flex-col items-center justify-between gap-3 border-t px-1 pt-3 text-sm sm:flex-row">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{totalItems} lançamentos</span>
        <Select
          onValueChange={(value) => value && onPageSizeChange(Number(value))}
          value={String(pageSize)}
        >
          <SelectTrigger aria-label="Lançamentos por página" className="h-8 w-20">
            <SelectValue>{pageSize}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {[5, 10, 20, 30, 40, 50, 100].map((size) => (
              <SelectItem key={size} value={String(size)}>
                {size}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 text-muted-foreground">
          Página {currentPage} de {pageCount}
        </span>
        <Button
          aria-label="Primeira página"
          disabled={currentPage === 1}
          onClick={() => onPageChange(1)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronsLeft />
        </Button>
        <Button
          aria-label="Página anterior"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronLeft />
        </Button>
        <Button
          aria-label="Próxima página"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(currentPage + 1)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronRight />
        </Button>
        <Button
          aria-label="Última página"
          disabled={currentPage === pageCount}
          onClick={() => onPageChange(pageCount)}
          size="icon-sm"
          variant="outline"
        >
          <ChevronsRight />
        </Button>
      </div>
    </div>
  );
}
