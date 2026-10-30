import type { TransactionSelectionSummary } from "@openmonetis/domain/transactions";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  CircleCheck,
  CircleDashed,
  Ellipsis,
  Loader2,
  type LucideIcon,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { MoneyValue } from "@/components/money-value";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { tagsQueryOptions } from "@/features/tags/tags.queries";
import { cn } from "@/lib/utils";
import {
  type BulkTransactionActionKey,
  describeBulkTransactionAction,
} from "../transactions.presentation";
import { useTransactionBulkActions } from "../useTransactionBulkActions";
import { TransactionBulkCategoryPicker } from "./transaction-bulk-category-picker";
import { TransactionBulkRenameDialog } from "./transaction-bulk-rename-dialog";
import { TransactionBulkTagPicker } from "./transaction-bulk-tag-picker";

type TransactionBulkActionDockProps = {
  summary: TransactionSelectionSummary;
  transactions: readonly TransactionOutput[];
  onClear: () => void;
};

function DockTooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function DockActionButton({
  action,
  activeAction,
  availability,
  className,
  icon: Icon,
  onClick,
}: {
  action: BulkTransactionActionKey;
  activeAction: BulkTransactionActionKey | null;
  availability: { count: number; total: number };
  className?: string;
  icon: LucideIcon;
  onClick: () => void;
}) {
  const description = describeBulkTransactionAction(action, availability);
  return (
    <DockTooltip label={description.hint}>
      {/* Unavailable actions stay focusable so the tooltip and the click can explain why. */}
      <Button
        aria-disabled={!description.available}
        aria-label={description.hint}
        className={cn("aria-disabled:opacity-70", className)}
        disabled={activeAction !== null}
        onClick={() =>
          description.available ? onClick() : toast.info(description.unavailableReason)
        }
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        {activeAction === action ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Icon aria-hidden="true" />
        )}
      </Button>
    </DockTooltip>
  );
}

export function TransactionBulkActionDock({
  summary,
  transactions,
  onClear,
}: TransactionBulkActionDockProps) {
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const tagsQuery = useQuery(tagsQueryOptions());
  const actions = useTransactionBulkActions(transactions);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  if (!summary.selectedCount) return null;

  const categories = (categoriesQuery.data ?? []).filter((category) =>
    actions.canCategorize(category),
  );
  const plural = summary.selectedCount === 1 ? "" : "s";
  const categorizeHint = describeBulkTransactionAction(
    "categorize",
    actions.availability.categorize,
  );
  const tagHint = describeBulkTransactionAction("tag", actions.availability.tag);
  const unsettleHint = describeBulkTransactionAction("unsettle", actions.availability.unsettle);

  return (
    <TooltipProvider delay={300}>
      {/* The dock always uses the dark palette so it stands out over both themes. */}
      <div
        aria-label="Ações para os lançamentos selecionados"
        className="dark sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 mx-auto w-full md:bottom-4 md:max-w-max"
        role="toolbar"
      >
        <div className="flex animate-in flex-wrap items-center justify-center gap-x-1 gap-y-1.5 rounded-2xl border bg-popover p-1.5 text-popover-foreground shadow-2xl ring-1 ring-foreground/15 duration-300 ease-out fade-in-0 slide-in-from-bottom-4 zoom-in-95 motion-reduce:animate-none md:flex-nowrap md:rounded-full">
          <div
            aria-live="polite"
            className="flex items-center gap-2 pr-2 max-md:w-full max-md:border-b max-md:pb-1.5"
            role="status"
          >
            <DockTooltip label="Limpar seleção">
              <Button
                aria-label="Limpar seleção"
                className="rounded-full"
                onClick={onClear}
                size="icon-sm"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" />
              </Button>
            </DockTooltip>
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-success px-1.5 font-semibold text-2xs text-background tabular-nums">
              {summary.selectedCount}
            </span>
            <span className="flex items-baseline gap-1.5 whitespace-nowrap text-sm">
              <span className="text-popover-foreground/85 max-md:sr-only">selecionado{plural}</span>
              <span aria-hidden="true" className="text-popover-foreground/85 max-md:hidden">
                ·
              </span>
              <MoneyValue
                amount={summary.balance}
                className={cn(
                  "font-semibold",
                  summary.balance > 0 && "text-success",
                  summary.balance < 0 && "text-destructive",
                )}
                showPositiveSign
              />
            </span>
            <span className="flex items-center gap-2 whitespace-nowrap text-popover-foreground/85 text-xs max-md:ml-auto max-md:grid max-md:justify-items-end max-md:gap-0">
              <span className="flex items-center gap-0.5" title="Entradas">
                <ArrowUp aria-hidden="true" className="size-3 text-success" />
                <span className="sr-only">Entradas</span>
                <MoneyValue amount={summary.inflow} />
              </span>
              <span className="flex items-center gap-0.5" title="Despesas">
                <ArrowDown aria-hidden="true" className="size-3 text-destructive" />
                <span className="sr-only">Despesas</span>
                <MoneyValue amount={summary.outflow} />
              </span>
            </span>
          </div>
          <span aria-hidden="true" className="h-5 w-px bg-border max-md:hidden" />
          <div className="flex items-center gap-0.5 text-popover-foreground">
            <DockActionButton
              action="settle"
              activeAction={actions.activeAction}
              availability={actions.availability.settle}
              icon={CircleCheck}
              onClick={() => void actions.settle(true)}
            />
            <DockTooltip label={categorizeHint.hint}>
              <TransactionBulkCategoryPicker
                blockedReason={
                  !categorizeHint.available
                    ? categorizeHint.unavailableReason
                    : categories.length
                      ? null
                      : "Nenhuma categoria combina com a seleção"
                }
                busy={actions.pending}
                categories={categories}
                onSelect={(category) => void actions.categorize(category)}
                pending={actions.activeAction === "categorize"}
              />
            </DockTooltip>
            <DockTooltip label={tagHint.hint}>
              <TransactionBulkTagPicker
                blockedReason={
                  !tagHint.available
                    ? tagHint.unavailableReason
                    : tagsQuery.data?.length
                      ? null
                      : "Cadastre uma etiqueta primeiro"
                }
                busy={actions.pending}
                onSelect={(tagId, operation) => void actions.tag(tagId, operation)}
                pending={actions.activeAction === "tag"}
                tags={tagsQuery.data ?? []}
                targetCount={actions.availability.tag.count}
              />
            </DockTooltip>
            <DockActionButton
              action="rename"
              activeAction={actions.activeAction}
              availability={actions.availability.rename}
              icon={Pencil}
              onClick={() => setDialog("rename")}
            />
            <DockActionButton
              action="delete"
              activeAction={actions.activeAction}
              availability={actions.availability.delete}
              className="text-destructive hover:text-destructive"
              icon={Trash2}
              onClick={() => setDialog("delete")}
            />
            <DropdownMenu>
              <DockTooltip label="Mais ações">
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label="Mais ações"
                      disabled={actions.pending}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  {actions.activeAction === "unsettle" ? (
                    <Loader2 aria-hidden="true" className="animate-spin" />
                  ) : (
                    <Ellipsis aria-hidden="true" />
                  )}
                </DropdownMenuTrigger>
              </DockTooltip>
              <DropdownMenuContent align="end" className="min-w-60" side="top">
                <DropdownMenuItem
                  className="items-start"
                  disabled={!unsettleHint.available}
                  onClick={() => void actions.settle(false)}
                >
                  <CircleDashed aria-hidden="true" className="mt-0.5" />
                  <span className="grid gap-0.5">
                    {unsettleHint.label}
                    <span className="text-muted-foreground text-xs">
                      {unsettleHint.available
                        ? `${actions.availability.unsettle.count} de ${actions.availability.unsettle.total} selecionados`
                        : unsettleHint.unavailableReason}
                    </span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <TransactionBulkRenameDialog
          onOpenChange={(open) => setDialog(open ? "rename" : null)}
          onSubmit={actions.rename}
          open={dialog === "rename"}
          transactions={actions.renameTargets}
        />
        <AlertDialog
          onOpenChange={(open) => {
            if (!actions.pending) setDialog(open ? "delete" : null);
          }}
          open={dialog === "delete"}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Excluir {actions.availability.delete.count} lançamento
                {actions.availability.delete.count === 1 ? "" : "s"}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Recorrências, lançamentos gerados pelo sistema e
                compras com estorno não são excluídos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={actions.pending}>Cancelar</AlertDialogCancel>
              <Button
                disabled={actions.pending}
                onClick={async () => {
                  await actions.remove();
                  setDialog(null);
                }}
                type="button"
                variant="destructive"
              >
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
