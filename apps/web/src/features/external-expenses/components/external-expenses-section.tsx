import type { ExternalExpenseOutput } from "@openmonetis/validators/external-expenses";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Barcode,
  CalendarClock,
  Check,
  CreditCard,
  HandCoins,
  Landmark,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import {
  formatCompactDate,
  formatPaymentMethodTable,
  transactionConditionLabels,
} from "@/features/transactions/transactions.presentation";
import { useImportExternalExpenseMutation } from "../external-expenses.mutations";
import { externalExpensesQueryOptions } from "../external-expenses.queries";
import { ExternalCounterpartAvatar } from "./external-counterpart-avatar";
import { ExternalExpenseSource } from "./external-expense-source";

export function ExternalExpensesSection({ period }: { period: string }) {
  const [importing, setImporting] = useState<ExternalExpenseOutput | null>(null);
  const query = useQuery(externalExpensesQueryOptions({ view: "pending", period }));
  const categories = useQuery(categoriesQueryOptions());
  const accounts = useQuery(accountsQueryOptions());
  const cards = useQuery(cardsQueryOptions());
  const people = useQuery(peopleQueryOptions());
  const importExpense = useImportExternalExpenseMutation();

  return (
    <div className="grid gap-4">
      <ExternalExpensesSummary
        isError={query.isError}
        isLoading={query.isLoading}
        total={query.data?.total}
        totalAmount={query.data?.totalAmount}
      />

      {query.isLoading ? <ExternalExpensesLoading /> : null}
      {query.isError ? (
        <Card className="border-dashed shadow-none">
          <CardContent className="grid justify-items-center py-12 text-center">
            <p className="font-medium">Não foi possível carregar os lançamentos externos</p>
            <Button className="mt-3" onClick={() => void query.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {query.data ? (
        query.data.items.length ? (
          <ExternalExpensesTable
            importPending={importExpense.isPending}
            items={query.data.items}
            onImport={setImporting}
          />
        ) : (
          <ExternalExpensesEmpty />
        )
      ) : null}

      <TransactionDialog
        accounts={accounts.data ?? []}
        allowedConditions={["single", "installment"]}
        cards={cards.data ?? []}
        categories={categories.data ?? []}
        createDefaults={importing ? createDefaultsFor(importing) : undefined}
        defaultPeriod={importing?.snapshot.period}
        defaultType="expense"
        key={importing?.id ?? "external-expense-import"}
        lockType
        onCreate={async (transaction) => {
          if (!importing) throw new Error("external_expense_missing");
          const result = await importExpense.mutateAsync({
            id: importing.id,
            expectedVersion: importing.sourceVersion,
            transaction,
          });
          return result.transaction;
        }}
        onOpenChange={(open) => !open && setImporting(null)}
        open={Boolean(importing)}
        people={people.data ?? []}
        transaction={null}
      />
    </div>
  );
}

function ExternalExpensesSummary({
  isError,
  isLoading,
  total,
  totalAmount,
}: {
  isError: boolean;
  isLoading: boolean;
  total: number | undefined;
  totalAmount: number | undefined;
}) {
  return (
    <FinancialSummaryHeader
      eyebrow="Lançamentos externos"
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <HandCoins aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[]}
      primaryLabel="Total aguardando importação"
      primaryValue={
        isLoading ? (
          <Skeleton className="h-12 w-52 bg-current/15 before:via-current/20" />
        ) : isError ? (
          <span className="text-xl">Indisponível</span>
        ) : (
          <MoneyValue amount={totalAmount ?? 0} />
        )
      }
      subtitle={
        isLoading
          ? "Calculando os lançamentos recebidos"
          : `${total ?? 0} ${
              total === 1 ? "lançamento aguardando importação" : "lançamentos aguardando importação"
            }`
      }
      title="Pendências recebidas"
      variant="soft"
    />
  );
}

function ExternalExpensesTable({
  importPending,
  items,
  onImport,
}: {
  importPending: boolean;
  items: ExternalExpenseOutput[];
  onImport: (item: ExternalExpenseOutput) => void;
}) {
  return (
    <Card className="py-2">
      <CardContent className="px-2 sm:px-4">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Estabelecimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Condição</TableHead>
                <TableHead>Forma de pagamento</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Conta/Cartão</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <ExternalExpenseRow
                  importPending={importPending}
                  item={item}
                  key={item.id}
                  onImport={() => onImport(item)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="border-t px-1 pt-3 text-muted-foreground text-sm">
          {items.length} {items.length === 1 ? "lançamento" : "lançamentos"}
        </p>
      </CardContent>
    </Card>
  );
}

function ExternalExpenseRow({
  importPending,
  item,
  onImport,
}: {
  importPending: boolean;
  item: ExternalExpenseOutput;
  onImport: () => void;
}) {
  const PaymentIcon =
    item.snapshot.paymentMethod === "credit_card" || item.snapshot.paymentMethod === "debit_card"
      ? CreditCard
      : item.snapshot.paymentMethod === "boleto"
        ? Barcode
        : item.snapshot.paymentMethod === "cash"
          ? Banknote
          : Landmark;
  const recurringDateLabel =
    item.sourceKind !== "recurringOccurrence"
      ? null
      : item.snapshot.paymentMethod === "boleto"
        ? "Vence em "
        : "Ocorrência em ";
  const displayedDate =
    item.sourceKind === "recurringOccurrence" && item.snapshot.paymentMethod === "boleto"
      ? (item.snapshot.dueDate ?? item.snapshot.purchaseDate)
      : item.snapshot.purchaseDate;

  return (
    <TableRow>
      <TableCell>
        <div className="flex min-w-56 items-center gap-2.5">
          <EstablishmentLogo
            fallbackLogoUrl={item.establishmentLogoUrl}
            name={item.snapshot.name}
            size={36}
          />
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="max-w-56 truncate font-medium">{item.snapshot.name}</span>
            <span className="whitespace-nowrap text-muted-foreground text-xs">
              {recurringDateLabel}
              {formatCompactDate(displayedDate)}
            </span>
          </span>
        </div>
      </TableCell>
      <TableCell className="whitespace-nowrap">
        <MoneyValue amount={-item.snapshot.amount} className="font-medium" />
      </TableCell>
      <TableCell>
        <span className="inline-flex items-center gap-2 whitespace-nowrap text-muted-foreground">
          {item.snapshot.condition === "installment" ? (
            <CalendarClock aria-hidden="true" size={14} />
          ) : item.snapshot.condition === "recurring" ? (
            <RefreshCw aria-hidden="true" size={14} />
          ) : (
            <Check aria-hidden="true" size={14} />
          )}
          {transactionConditionLabels[item.snapshot.condition]}
          {item.snapshot.installmentCount ? ` · ${item.snapshot.installmentCount}x` : ""}
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap text-muted-foreground">
        <PaymentIcon className="mr-2 inline size-4" />
        {formatPaymentMethodTable(item.snapshot.paymentMethod)}
      </TableCell>
      <TableCell>
        <span className="inline-flex min-w-40 items-center gap-2">
          <ExternalCounterpartAvatar
            avatarUrl={item.counterpartAvatarUrl}
            className="size-7"
            name={item.counterpartName}
          />
          <span className="grid">
            <span className="text-muted-foreground text-xs">Compartilhado por</span>
            <span className="font-medium text-sm">{item.counterpartName}</span>
          </span>
        </span>
      </TableCell>
      <TableCell>
        <span className="whitespace-nowrap text-muted-foreground">
          <ExternalExpenseSource
            sourceCardBrand={item.sourceCardBrand}
            sourceLabel={item.snapshot.sourceLabel}
            sourceLogoUrl={item.sourceLogoUrl}
          />
          {!item.snapshot.sourceLabel ? "—" : null}
        </span>
      </TableCell>
      <TableCell className="text-right">
        <Button disabled={importPending} onClick={onImport} size="sm">
          Importar para minha conta
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ExternalExpensesEmpty() {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="grid place-items-center py-14 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">Nenhum lançamento pendente</p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          Novos lançamentos externos aparecerão aqui para importação.
        </p>
      </CardContent>
    </Card>
  );
}

function createDefaultsFor(item: ExternalExpenseOutput) {
  const snapshot = item.snapshot;
  return {
    amount: String(snapshot.amount),
    condition: item.sourceKind === "recurringOccurrence" ? "single" : snapshot.condition,
    dueDate: snapshot.dueDate ?? "",
    installmentCount: String(snapshot.installmentCount ?? 2),
    invoicePeriod: snapshot.period,
    isSettled: snapshot.paymentMethod === "credit_card" ? "true" : "false",
    name: snapshot.name,
    paymentMethod: snapshot.paymentMethod,
    purchaseDate: snapshot.purchaseDate,
    startInstallment: String(snapshot.currentInstallment ?? 1),
  } as const;
}

function ExternalExpensesLoading() {
  return (
    <Card className="py-2">
      <CardContent className="grid gap-3 px-4 py-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </CardContent>
    </Card>
  );
}
