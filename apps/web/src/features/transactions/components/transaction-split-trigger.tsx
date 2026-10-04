import { ChevronRight, Link2, Trash2, Users } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";

import { SplitAvatarStack } from "./transaction-split-avatar-stack";
import type { TransactionSplitDialogProps } from "./transaction-split-dialog.types";

export function TransactionSplitTrigger({
  open,
  setRemovalOpen,
  committedAllocation,
  isDivided,
  connectedShares,
  cardDisabled,
  openEditor,
  disabledReason,
  people,
  value,
}: {
  open: ReturnType<typeof useTransactionSplitEditor>["open"];
  setRemovalOpen: ReturnType<typeof useTransactionSplitEditor>["setRemovalOpen"];
  committedAllocation: ReturnType<typeof useTransactionSplitEditor>["committedAllocation"];
  isDivided: ReturnType<typeof useTransactionSplitEditor>["isDivided"];
  connectedShares: ReturnType<typeof useTransactionSplitEditor>["connectedShares"];
  cardDisabled: ReturnType<typeof useTransactionSplitEditor>["cardDisabled"];
  openEditor: ReturnType<typeof useTransactionSplitEditor>["openEditor"];
  disabledReason: ReturnType<typeof useTransactionSplitEditor>["disabledReason"];
  people: TransactionSplitDialogProps["people"];
  value: TransactionSplitDialogProps["value"];
}) {
  return (
    <section
      className={cn(
        "group rounded-lg border border-input bg-popover transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
        !cardDisabled && "hover:border-brand-strong/40 hover:bg-accent/40",
        isDivided && "border-brand-strong/20 bg-brand/5",
        cardDisabled && "bg-muted/30",
      )}
    >
      <div className="flex items-center">
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left outline-none",
            !cardDisabled && "cursor-pointer",
          )}
          disabled={cardDisabled}
          onClick={openEditor}
          type="button"
        >
          {isDivided ? (
            <SplitAvatarStack people={people} shares={value} />
          ) : (
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand-strong transition-transform group-hover:scale-105">
              <Users className="size-4" />
            </span>
          )}
          <span className="min-w-0 flex-1 space-y-1">
            <span className="block truncate font-medium text-sm">
              {isDivided ? "Divisão do lançamento" : "Dividir lançamento"}
            </span>
            {isDivided ? (
              <span className="block truncate text-muted-foreground text-xs">
                Total distribuído: <MoneyValue amount={committedAllocation.allocatedCents / 100} />
                <span aria-hidden="true"> · </span>
                {value.length} pessoas
              </span>
            ) : (
              <span className="block text-muted-foreground text-xs">
                {disabledReason ?? "Atribua partes do valor a duas ou mais pessoas."}
              </span>
            )}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
          />
        </button>
        {isDivided ? (
          <>
            <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    aria-label="Remover divisão"
                    className="mx-0.5 size-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setRemovalOpen(true)}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  />
                }
              >
                <Trash2 aria-hidden="true" className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent>Remover divisão</TooltipContent>
            </Tooltip>
          </>
        ) : null}
      </div>
      {connectedShares.length > 0 ? (
        <p className="mx-3 mb-2.5 flex items-center gap-1.5 rounded-md bg-brand/5 px-2 py-1.5 text-brand-strong text-xs">
          <Link2 aria-hidden="true" className="size-3.5" />
          {connectedShares.length === 1
            ? "1 pessoa conectada receberá este gasto para revisar."
            : `${connectedShares.length} pessoas conectadas receberão este gasto para revisar.`}
        </p>
      ) : null}
    </section>
  );
}
