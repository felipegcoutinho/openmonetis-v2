import type { AccountOutput } from "@openmonetis/validators/accounts";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Archive, FileText, Info, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { accountTypeLabels } from "../accounts.presentation";

type AccountCardProps = {
  account: AccountOutput;
  onArchive?: (account: AccountOutput) => Promise<void>;
  onDelete?: (account: AccountOutput) => Promise<void>;
  onEdit: (account: AccountOutput) => void;
  pending?: boolean;
};

export function AccountCard({
  account,
  onArchive,
  onDelete,
  onEdit,
  pending = false,
}: AccountCardProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const isInactive = account.isArchived;
  const hasAccountingNote = account.excludeFromBalance;

  return (
    <Card className={cn("gap-5", isInactive && "opacity-70")}>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {account.logo ? (
              <Image
                alt={`Logo de ${account.name}`}
                className="size-11 shrink-0 rounded-full object-contain"
                height={44}
                layout="fixed"
                src={account.logo}
                width={44}
              />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground text-xs">
                {account.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CardTitle className="truncate">
                  <Link
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    to="/accounts/$accountId"
                    params={{ accountId: account.id }}
                  >
                    {account.name}
                  </Link>
                </CardTitle>
                {hasAccountingNote ? (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={`Informações de saldo de ${account.name}`}
                      render={
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          type="button"
                        />
                      }
                    >
                      <Info aria-hidden="true" className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {account.excludeFromBalance ? (
                        <p>Esta conta não participa do saldo consolidado.</p>
                      ) : null}
                    </TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p className="mt-0.5 truncate text-muted-foreground text-xs">
                {accountTypeLabels[account.type]}
                {account.excludeFromBalance ? " · Fora do saldo total" : null}
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 rounded-full",
                isInactive ? "bg-muted-foreground" : "bg-emerald-500",
              )}
            />
            {isInactive ? "Inativa" : "Ativa"}
          </span>
        </div>
      </CardHeader>

      <CardContent>
        <div>
          <p className="text-muted-foreground text-xs">Saldo</p>
          <MoneyValue amount={account.summary.balance} className="mt-1 font-medium text-2xl" />
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-3 border-t pt-3">
        <Link
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          params={{ accountId: account.id }}
          to="/accounts/$accountId"
        >
          <FileText aria-hidden="true" className="size-3.5" />
          Extrato
        </Link>
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onEdit(account)}
          type="button"
        >
          <Pencil aria-hidden="true" className="size-3.5" />
          Editar
        </button>
        {onArchive ? (
          <button
            className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-muted-foreground text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={pending}
            onClick={() => setArchiveOpen(true)}
            type="button"
          >
            <Archive aria-hidden="true" className="size-3.5" />
            Inativar
          </button>
        ) : null}
        {onDelete ? (
          <button
            className="ml-auto inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-destructive text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
            disabled={pending}
            onClick={() => setDeleteOpen(true)}
            type="button"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />
            Excluir
          </button>
        ) : null}
      </CardFooter>

      <AlertDialog onOpenChange={setArchiveOpen} open={archiveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta &quot;{account.name}&quot; será movida para contas inativas. Você poderá
              reativá-la depois pela edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (onArchive) void onArchive(account).then(() => setArchiveOpen(false));
              }}
              variant="destructive"
            >
              {pending ? "Inativando..." : "Inativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog onOpenChange={setDeleteOpen} open={deleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os lançamentos, recorrências, pagamentos e cartões vinculados à conta &quot;
              {account.name}&quot; serão removidos. Isso alterará saldos, receitas, despesas e
              outros cálculos financeiros. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (onDelete)
                  void onDelete(account)
                    .then(() => setDeleteOpen(false))
                    .catch(() => {});
              }}
              variant="destructive"
            >
              {pending ? "Excluindo..." : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
