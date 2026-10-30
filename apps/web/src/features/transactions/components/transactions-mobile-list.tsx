import {
  balanceAdjustmentCategoryName,
  invoicePaymentCategoryName,
  yieldCategoryName,
} from "@openmonetis/domain/categories";
import { dateOnlyToSafeInstant, formatDateInBrazil } from "@openmonetis/shared/date-time";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ChevronLeft, ChevronRight, Circle, CreditCard, FileUp, Landmark } from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { TransactionTags } from "@/features/tags/components/transaction-tags";
import { cn } from "@/lib/utils";
import { formatCompactDate } from "../transactions.presentation";
import { useTransactionSelection } from "../useTransactionSelection";
import { TransactionBulkActionDock } from "./transaction-bulk-action-dock";
import { TransactionDueDate } from "./transaction-due-date";
import {
  TransactionsMobileActionsMenu,
  type TransactionsMobileExport,
} from "./transactions-mobile-actions-menu";

type TransactionsMobileListProps = {
  accountStatement?: boolean;
  allowImport?: boolean;
  exportOptions?: TransactionsMobileExport;
  transactions: TransactionOutput[];
  currentPage: number;
  pageCount: number;
  totalItems: number;
  onView: (transaction: TransactionOutput) => void;
  onPageChange: (page: number) => void;
};

export function TransactionsMobileList(props: TransactionsMobileListProps) {
  const [selectionMode, setSelectionMode] = useState(false);
  const selection = useTransactionSelection(props.transactions);
  const groups = new Map<string, TransactionOutput[]>();
  for (const transaction of props.transactions) {
    const date = props.accountStatement
      ? (transaction.postingDate ?? transaction.purchaseDate)
      : transaction.purchaseDate;
    groups.set(date, [...(groups.get(date) ?? []), transaction]);
  }

  if (!props.transactions.length) {
    return (
      <Card className="grid min-h-52 place-items-center border-dashed p-8 text-center">
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-primary/10 text-brand-strong">
            <Circle aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-semibold">Nenhum lançamento encontrado</h2>
          <p className="mt-1 text-muted-foreground text-sm">Ajuste os filtros ou crie um novo.</p>
          {props.allowImport ? (
            <Button asChild className="mt-4" size="sm" variant="outline">
              <Link to="/transactions/import">
                <FileUp aria-hidden="true" /> Importar extrato
              </Link>
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <div className="flex min-h-8 items-center justify-between gap-2">
        {selectionMode ? (
          <>
            <div className="mr-auto flex items-center gap-2 text-sm">
              <Checkbox
                aria-label="Selecionar lançamentos operacionais desta página"
                checked={selection.allSelectableSelected}
                disabled={!selection.selectableCount}
                onCheckedChange={selection.setAllSelectableSelected}
              />
              Selecionar página
            </div>
            <Button
              onClick={() => {
                selection.clear();
                setSelectionMode(false);
              }}
              size="sm"
              variant="ghost"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground text-sm">
              {props.totalItems === 1 ? "1 lançamento" : `${props.totalItems} lançamentos`}
            </p>
            <TransactionsMobileActionsMenu
              allowImport={Boolean(props.allowImport)}
              exportOptions={props.exportOptions}
              onSelect={() => setSelectionMode(true)}
            />
          </>
        )}
      </div>
      {[...groups.entries()].map(([date, transactions]) => (
        <section aria-labelledby={`transactions-${date}`} className="grid gap-2" key={date}>
          <h2 className="eyebrow px-1 text-muted-foreground" id={`transactions-${date}`}>
            {formatGroupDate(date)}
          </h2>
          <Card className="gap-0 overflow-hidden py-0">
            <ul className="divide-y">
              {transactions.map((transaction) => (
                <MobileTransactionRow
                  key={transaction.id}
                  {...props}
                  onSelectionChange={(selected) => selection.setSelected(transaction.id, selected)}
                  selected={selection.isSelected(transaction.id)}
                  selectable={selection.isSelectable(transaction)}
                  selectionMode={selectionMode}
                  transaction={transaction}
                />
              ))}
            </ul>
          </Card>
        </section>
      ))}
      <TransactionBulkActionDock
        onClear={selection.clear}
        summary={selection.summary}
        transactions={selection.selectedTransactions}
      />

      <footer className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">{props.totalItems} lançamentos</span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Página anterior"
            disabled={props.currentPage === 1}
            onClick={() => props.onPageChange(props.currentPage - 1)}
            size="icon-sm"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="min-w-16 text-center text-muted-foreground text-xs">
            {props.currentPage} de {props.pageCount}
          </span>
          <Button
            aria-label="Próxima página"
            disabled={props.currentPage === props.pageCount}
            onClick={() => props.onPageChange(props.currentPage + 1)}
            size="icon-sm"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

function MobileTransactionRow({
  accountStatement,
  transaction,
  onView,
  selectionMode,
  selected,
  selectable,
  onSelectionChange,
}: TransactionsMobileListProps & {
  transaction: TransactionOutput;
  selectionMode: boolean;
  selected: boolean;
  selectable: boolean;
  onSelectionChange: (selected: boolean) => void;
}) {
  const visibleAmount = transaction.allocation?.amount ?? transaction.amount;
  const isBalanceAdjustment =
    transaction.categoryName === balanceAdjustmentCategoryName ||
    transaction.paymentMethod === null;
  const isInvoicePayment = transaction.categoryName === invoicePaymentCategoryName;
  const isInvoiceAdjustment = transaction.origin === "invoiceAdjustment";
  const isAccountYield =
    transaction.type === "income" &&
    transaction.categoryName === yieldCategoryName &&
    transaction.accountId !== null;
  const featuredLogo = isInvoicePayment
    ? transaction.invoicePaymentCardLogo
    : isInvoiceAdjustment
      ? transaction.cardLogo
      : isBalanceAdjustment || isAccountYield
        ? (transaction.accountLogo ?? transaction.cardLogo)
        : null;
  const relationLogo =
    transaction.invoicePaymentCardLogo ??
    transaction.cardLogo ??
    transaction.accountLogo ??
    transaction.sourceAccountLogo ??
    transaction.destinationAccountLogo;

  return (
    <li
      className={cn(
        "flex min-h-20 items-center gap-3 px-3 py-3",
        isInvoicePayment && "bg-success/5",
        selected && "bg-brand/5",
      )}
    >
      {selectionMode ? (
        <Checkbox
          aria-label={
            selectable
              ? `Selecionar ${transaction.name}`
              : `${transaction.name} não participa da conferência`
          }
          checked={selected}
          className={cn(!selectable && "opacity-20!")}
          disabled={!selectable}
          onCheckedChange={onSelectionChange}
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <button
          aria-label={
            selectionMode
              ? selectable
                ? `${selected ? "Remover" : "Adicionar"} ${transaction.name} da seleção`
                : `${transaction.name} não participa da conferência`
              : `Ver detalhes de ${transaction.name}`
          }
          className="flex w-full min-w-0 items-center gap-3 text-left disabled:cursor-default"
          disabled={selectionMode && !selectable}
          onClick={() => {
            if (selectionMode) {
              if (selectable) onSelectionChange(!selected);
              return;
            }
            onView(transaction);
          }}
          type="button"
        >
          <span className="shrink-0">
            {featuredLogo ? (
              <Image
                alt=""
                className="size-10 rounded-full object-contain"
                height={40}
                layout="fixed"
                src={featuredLogo}
                width={40}
              />
            ) : (
              <EstablishmentLogo
                categoryIcon={transaction.categoryIcon}
                editable={false}
                name={transaction.name}
                size={40}
              />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate font-medium text-sm">{transaction.name}</span>
              {transaction.currentInstallment && transaction.installmentCount ? (
                <span className="shrink-0 text-muted-foreground text-2xs">
                  {transaction.currentInstallment}/{transaction.installmentCount}
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs">
              {relationLogo ? (
                <Image
                  alt=""
                  className="size-4 shrink-0 rounded-full object-contain"
                  height={16}
                  layout="fixed"
                  src={relationLogo}
                  width={16}
                />
              ) : transaction.cardId || transaction.invoicePaymentCardName ? (
                <CreditCard aria-hidden="true" className="size-4 shrink-0" />
              ) : transaction.accountId || transaction.type === "transfer" ? (
                <Landmark aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
              <span className="truncate">{transaction.categoryName ?? "Sem categoria"}</span>
            </span>
            {transaction.paymentMethod === "boleto" && transaction.boletoPaymentDate ? (
              <span className="mt-1 block text-muted-foreground text-xs">
                {accountStatement
                  ? null
                  : `Pago ${formatCompactDate(transaction.boletoPaymentDate)}`}
              </span>
            ) : null}
            <TransactionTags tagIds={transaction.tagIds} />
          </span>
          <span className="shrink-0 text-right">
            <MoneyValue
              amount={visibleAmount}
              className={cn(
                "block font-medium text-sm",
                transaction.type === "income" && "text-success",
                transaction.type === "transfer" && "text-info",
              )}
              showPositiveSign={transaction.type === "income" || visibleAmount > 0}
            />
            {transaction.settledAmount != null &&
            transaction.plannedAmount != null &&
            transaction.settledAmount !== transaction.plannedAmount ? (
              <span
                className="block text-muted-foreground text-xs"
                title={`Previsto total: ${transaction.plannedAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
              >
                Valor ajustado
              </span>
            ) : null}
          </span>
        </button>
        {transaction.dueDate ? (
          <div className="mt-1 ml-11 text-xs">
            <TransactionDueDate transaction={transaction} />
          </div>
        ) : null}
      </div>
    </li>
  );
}

function formatGroupDate(value: string) {
  const label = formatDateInBrazil(dateOnlyToSafeInstant(value), {
    day: "2-digit",
    month: "long",
    weekday: "long",
  });
  return `${label.charAt(0).toLocaleUpperCase("pt-BR")}${label.slice(1)}`;
}
