import type { CardOutput } from "@openmonetis/validators/cards";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Archive, CalendarDays, FileText, Info, Pencil, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";
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
import { formatPeriod } from "@/features/transactions/transactions.presentation";
import { cn } from "@/lib/utils";
import { getCardBrandAsset } from "../card-brand-assets";
import {
  cardBrandLabels,
  cardInvoiceStatusLabels,
  formatInvoiceDate,
  getCardClosingRuleDescription,
} from "../cards.presentation";

type CardCardProps = {
  card: CardOutput;
  onArchive?: (card: CardOutput) => Promise<void>;
  onDelete?: (card: CardOutput) => Promise<void>;
  onEdit: (card: CardOutput) => void;
  pending?: boolean;
};

export function CardCard({ card, onArchive, onDelete, onEdit, pending = false }: CardCardProps) {
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const brandAsset = getCardBrandAsset(card.brand);
  const isInactive = card.status === "inactive";

  return (
    <Card data-mobile-entity-card className={cn("min-h-72 gap-5", isInactive && "opacity-70")}>
      <CardHeader className="gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {card.logo ? (
              <Image
                alt={`Logo de ${card.name}`}
                className="size-11 shrink-0 rounded-full object-contain"
                height={44}
                layout="fixed"
                src={card.logo}
                width={44}
              />
            ) : (
              <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground text-xs">
                {card.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <CardTitle className="truncate">
                  <Link
                    className="hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                    to="/cards/$cardId"
                    params={{ cardId: card.id }}
                  >
                    {card.name}
                  </Link>
                </CardTitle>
                {card.note ? (
                  <Tooltip>
                    <TooltipTrigger
                      aria-label={`Observação de ${card.name}`}
                      render={
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          type="button"
                        />
                      }
                    >
                      <Info aria-hidden="true" className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">{card.note}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {isInactive ? "Inativo" : "Ativo"}
              </p>
            </div>
          </div>
          {brandAsset ? (
            <Image
              alt={cardBrandLabels[card.brand]}
              className="h-5 w-auto shrink-0 object-contain"
              height={20}
              layout="fixed"
              src={brandAsset}
              width={36}
            />
          ) : (
            <span className="text-muted-foreground text-xs">{cardBrandLabels[card.brand]}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand/5 p-3 text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarDays aria-hidden="true" className="size-4" />
            {card.closingDayPurchasesNextInvoice ? (
              <>
                Fecha{" "}
                <strong className="font-medium text-foreground">
                  {formatInvoiceDate(card.invoiceSummary.closingDate)}
                </strong>
              </>
            ) : card.closingRuleType === "fixedDay" ? (
              <>
                Fecha <strong className="font-medium text-foreground">dia {card.closingDay}</strong>
              </>
            ) : (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      className="border-muted-foreground/50 border-b border-solid font-medium text-foreground focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      type="button"
                    />
                  }
                >
                  Fechamento variável
                </TooltipTrigger>
                <TooltipContent>{getCardClosingRuleDescription(card)}</TooltipContent>
              </Tooltip>
            )}
          </span>
          <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
            Vence <strong className="font-medium text-foreground">dia {card.dueDay}</strong>
          </span>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-muted-foreground text-xs">
              Fatura de {formatPeriod(card.invoiceSummary.period)}
            </p>
            <span
              className={cn(
                "rounded-full bg-muted px-2 py-0.5 font-medium text-[10px]",
                card.invoiceSummary.status === "paid" && "bg-success/10 text-success",
                card.invoiceSummary.status === "overdue" && "bg-destructive/10 text-destructive",
              )}
            >
              {cardInvoiceStatusLabels[card.invoiceSummary.status]}
            </span>
          </div>
          <MoneyValue amount={card.invoiceSummary.amount} className="mt-1 font-medium text-2xl" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <CardMetric
            label="Limite total"
            value={<MoneyValue amount={card.invoiceSummary.totalLimit} />}
          />
          <CardMetric
            label="Limite utilizado"
            value={<MoneyValue amount={card.invoiceSummary.usedLimit} />}
          />
          <CardMetric
            label="Limite disponível"
            value={<MoneyValue amount={card.invoiceSummary.availableLimit} />}
          />
        </div>
        <p className="text-muted-foreground text-xs">Parcelas futuras também ocupam o limite.</p>
        <div className="flex flex-col gap-2">
          <div
            aria-label={`${card.invoiceSummary.usagePercentage.toLocaleString("pt-BR")}% do limite utilizado`}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
          >
            <div
              className={cn(
                "h-full rounded-full bg-brand transition-[width]",
                card.invoiceSummary.usagePercentage > 100 && "bg-destructive",
              )}
              style={{ width: `${Math.min(100, card.invoiceSummary.usagePercentage)}%` }}
            />
          </div>
          <span className="text-muted-foreground text-xs">
            {card.invoiceSummary.usagePercentage.toLocaleString("pt-BR")} % do limite utilizado
          </span>
        </div>
      </CardContent>

      <CardFooter className="mt-auto flex flex-wrap gap-3 border-t pt-3">
        <Link
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          params={{ cardId: card.id }}
          to="/cards/$cardId"
        >
          <FileText aria-hidden="true" className="size-3.5" />
          Fatura
        </Link>
        <button
          className="inline-flex items-center gap-1 rounded-sm px-1 py-0.5 font-medium text-brand-strong text-sm transition-opacity hover:opacity-80 focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onEdit(card)}
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
            <AlertDialogTitle>Inativar cartão?</AlertDialogTitle>
            <AlertDialogDescription>
              O cartão &quot;{card.name}&quot; será movido para cartões inativos. Você poderá
              reativá-lo depois pela edição.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (onArchive) void onArchive(card).then(() => setArchiveOpen(false));
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
            <AlertDialogTitle>Excluir cartão permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as faturas, compras, recorrências e pagamentos vinculados ao cartão &quot;
              {card.name}&quot; serão removidos. Isso alterará saldos, receitas, despesas e outros
              cálculos financeiros. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                if (onDelete) void onDelete(card).then(() => setDeleteOpen(false));
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

function CardMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="mt-0.5 truncate font-medium text-sm tabular-nums">{value}</p>
    </div>
  );
}
