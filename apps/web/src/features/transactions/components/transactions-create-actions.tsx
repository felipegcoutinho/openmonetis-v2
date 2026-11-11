import { ChevronDown, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

import type { useTransactionsDialogs } from "../useTransactionsDialogs";
import { transactionTypeIcons } from "./transaction-type-badge";
import type { TransactionCreateType, TransactionsScreenProps } from "./transactions-screen.types";
import { createTransactionLabels } from "./transactions-screen-options";

/** Expenses are the most frequent entry, so they get the one-click primary action. */
const preferredPrimaryType: TransactionCreateType = "expense";

export function TransactionsCreateActions({
  createTypes,
  createDefaults,
  openCreateDialog,
}: {
  createTypes: readonly TransactionCreateType[];
  createDefaults: TransactionsScreenProps["createDefaults"];
  openCreateDialog: ReturnType<typeof useTransactionsDialogs>["openCreateDialog"];
}) {
  const primaryType = createTypes.includes(preferredPrimaryType)
    ? preferredPrimaryType
    : createTypes[0];
  if (!primaryType) return null;
  const secondaryTypes = createTypes.filter((type) => type !== primaryType);
  const labelFor = (type: TransactionCreateType) =>
    type === "income" && createDefaults?.paymentMethod === "credit_card"
      ? "Novo crédito na fatura"
      : createTransactionLabels[type];

  return (
    <div className="flex w-full sm:w-auto">
      <Button
        className={cn(
          "flex-1 gap-1.5 max-md:h-12 max-md:min-h-12 sm:flex-none",
          secondaryTypes.length && "rounded-e-none",
        )}
        onClick={() => openCreateDialog(primaryType)}
        type="button"
      >
        <Plus aria-hidden="true" />
        {labelFor(primaryType)}
      </Button>
      {secondaryTypes.length ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Outros tipos de lançamento"
                className="w-9 shrink-0 rounded-s-none border-primary-foreground/25 border-s px-0 max-md:h-12 max-md:min-h-12 max-md:w-12"
                type="button"
              />
            }
          >
            <ChevronDown
              aria-hidden="true"
              className="transition-transform group-data-popup-open/button:rotate-180"
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {secondaryTypes.map((type) => {
              const Icon = transactionTypeIcons[type];

              return (
                <DropdownMenuItem key={type} onClick={() => openCreateDialog(type)}>
                  <Icon aria-hidden="true" />
                  {labelFor(type)}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
