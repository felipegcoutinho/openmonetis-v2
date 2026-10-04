import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import type { useTransactionsDialogs } from "../useTransactionsDialogs";
import { transactionTypeIcons } from "./transaction-type-badge";
import type { TransactionCreateType, TransactionsScreenProps } from "./transactions-screen.types";
import { createTransactionLabels } from "./transactions-screen-options";

export function TransactionsCreateActions({
  createTypes,
  createDefaults,
  openCreateDialog,
}: {
  createTypes: readonly TransactionCreateType[];
  createDefaults: TransactionsScreenProps["createDefaults"];
  openCreateDialog: ReturnType<typeof useTransactionsDialogs>["openCreateDialog"];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        closeDelay={150}
        delay={0}
        openOnHover
        render={
          <Button
            aria-label="Criar novo lançamento"
            className="w-full gap-0 overflow-hidden p-0 max-md:h-12 max-md:min-h-12 sm:w-auto"
            type="button"
          />
        }
      >
        <span aria-hidden="true" className="w-9 shrink-0 max-md:w-12 sm:hidden" />
        <span className="flex h-full flex-1 items-center justify-center gap-1.5 px-3">
          <Plus aria-hidden="true" />
          Novo lançamento
        </span>
        <span className="grid h-full w-9 shrink-0 place-items-center border-primary-foreground/25 border-l max-md:w-12">
          <ChevronDown
            aria-hidden="true"
            className="transition-transform group-data-popup-open/button:rotate-180"
          />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {createTypes.map((type) => {
          const Icon = transactionTypeIcons[type];

          return (
            <DropdownMenuItem key={type} onClick={() => openCreateDialog(type)}>
              <Icon aria-hidden="true" />
              {type === "income" && createDefaults?.paymentMethod === "credit_card"
                ? "Novo crédito na fatura"
                : createTransactionLabels[type]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
