import type {
  ExternalExpenseOutput,
  ListExternalExpensesQuery,
} from "@openmonetis/validators/external-expenses";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Barcode,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  HandCoins,
  Landmark,
  RefreshCw,
  Search,
  Split,
  X,
} from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import {
  useImportExternalExpenseMutation,
  useReviewExternalExpenseMutation,
} from "../external-expenses.mutations";
import { externalExpensesQueryOptions } from "../external-expenses.queries";
import { ExternalCounterpartAvatar } from "./external-counterpart-avatar";
import { ExternalExpenseSource } from "./external-expense-source";

type ExternalExpenseSort = NonNullable<ListExternalExpensesQuery["sort"]>;

const externalExpenseSortLabels: Record<ExternalExpenseSort, string> = {
  recent: "Mais recentes",
  oldest: "Mais antigos",
  amountDesc: "Maior valor",
  amountAsc: "Menor valor",
  name: "Estabelecimento (A–Z)",
};

export function ExternalExpensesSection({ period }: { period: string }) {
  const [importing, setImporting] = useState<ExternalExpenseOutput | null>(null);
  const [view, setView] = useState<"pending" | "ignored">("pending");
  const reviewExpense = useReviewExternalExpenseMutation();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<ExternalExpenseSort>("recent");
  const [pagination, setPagination] = useState({ period, page: 1 });
  const page = pagination.period === period ? pagination.page : 1;
  const q = useDeferredValue(search.trim());
  const summaryQuery = useQuery(externalExpensesQueryOptions({ view: "pending", period }));
  const query = useQuery(externalExpensesQueryOptions({ view, period, q, sort, page }));
  const categories = useQuery(categoriesQueryOptions());
  const accounts = useQuery(accountsQueryOptions());
  const cards = useQuery(cardsQueryOptions());
  const people = useQuery(peopleQueryOptions());
  const importExpense = useImportExternalExpenseMutation();

  async function review(item: ExternalExpenseOutput, action: "ignore" | "restore") {
    try {
      const updated = await reviewExpense.mutateAsync({
        id: item.id,
        expectedVersion: item.sourceVersion,
        action,
      });
      setPagination({ period, page: 1 });
      toast.success(action === "ignore" ? "Lançamento ignorado" : "Lançamento restaurado", {
        description:
          action === "ignore"
            ? "O original permanece na conta de quem compartilhou."
            : "Disponível novamente para importação.",
        action:
          action === "ignore"
            ? {
                label: "Desfazer",
                onClick: () => {
                  void review(updated, "restore");
                },
              }
            : undefined,
      });
    } catch {
      toast.error("Não foi possível atualizar. Recarregue a lista e tente novamente.");
    }
  }

  return (
    <div className="grid gap-4">
      <ExternalExpensesSummary
        isError={summaryQuery.isError}
        isLoading={summaryQuery.isLoading}
        total={summaryQuery.data?.total}
        totalAmount={summaryQuery.data?.totalAmount}
      />

      <p className="text-sm text-muted-foreground">
        Ignorar remove apenas a pendência recebida; não quita nem cancela a despesa. Compras
        parceladas são ignoradas por inteiro; recorrências, somente nesta ocorrência.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
        <Select
          value={view}
          onValueChange={(value) => {
            if (value !== "pending" && value !== "ignored") return;
            setView(value);
            setPagination({ period, page: 1 });
          }}
        >
          <SelectTrigger className="sm:mr-auto w-44" aria-label="Situação dos lançamentos externos">
            <SelectValue>{view === "pending" ? "Pendentes" : "Ignorados"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="ignored">Ignorados</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <span>Ordenar por</span>
          <Select
            onValueChange={(value) => {
              setSort(value as ExternalExpenseSort);
              setPagination({ period, page: 1 });
            }}
            value={sort}
          >
            <SelectTrigger aria-label="Ordenar despesas compartilhadas" className="w-44">
              <SelectValue>{externalExpenseSortLabels[sort]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(externalExpenseSortLabels).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="relative w-full sm:w-72">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            aria-label="Buscar despesas compartilhadas"
            className="pr-9 pl-9"
            maxLength={160}
            onChange={(event) => {
              setSearch(event.target.value);
              setPagination({ period, page: 1 });
            }}
            placeholder="Buscar estabelecimento, pessoa ou conta/cartão"
            value={search}
          />
          {search ? (
            <button
              aria-label="Limpar busca"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              onClick={() => {
                setSearch("");
                setPagination({ period, page: 1 });
              }}
              type="button"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
      </div>

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
            importPending={importExpense.isPending || reviewExpense.isPending}
            onReview={(item) => void review(item, item.status === "ignored" ? "restore" : "ignore")}
            items={query.data.items}
            onImport={setImporting}
            onPageChange={(nextPage) => setPagination({ period, page: nextPage })}
            page={page}
            total={query.data.total}
            totalPages={query.data.totalPages}
          />
        ) : (
          <ExternalExpensesEmpty searched={Boolean(q)} ignored={view === "ignored"} />
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
          setPagination({ period, page: 1 });
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
  onReview,
  onPageChange,
  page,
  total,
  totalPages,
}: {
  importPending: boolean;
  items: ExternalExpenseOutput[];
  onImport: (item: ExternalExpenseOutput) => void;
  onReview: (item: ExternalExpenseOutput) => void;
  onPageChange: (page: number) => void;
  page: number;
  total: number;
  totalPages: number;
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
                  onReview={() => onReview(item)}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t px-1 pt-3 text-muted-foreground text-sm">
          <span>
            {total} {total === 1 ? "lançamento" : "lançamentos"}
          </span>
          {totalPages > 1 ? (
            <div className="flex items-center gap-2">
              <Button
                aria-label="Página anterior"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <span>
                Página {page} de {totalPages}
              </span>
              <Button
                aria-label="Próxima página"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
                size="icon-sm"
                variant="outline"
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ExternalExpenseRow({
  importPending,
  item,
  onImport,
  onReview,
}: {
  importPending: boolean;
  item: ExternalExpenseOutput;
  onImport: () => void;
  onReview: () => void;
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
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="max-w-56 truncate font-medium">{item.snapshot.name}</span>
              {item.isDivided ? (
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Lançamento dividido"
                    className="inline-flex shrink-0 rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Split aria-hidden="true" className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>Lançamento dividido</TooltipContent>
                </Tooltip>
              ) : null}
            </span>
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
        <div className="flex justify-end gap-2">
          <Button disabled={importPending} onClick={onReview} size="sm" variant="ghost">
            {item.status === "ignored" ? "Restaurar" : "Ignorar"}
          </Button>
          {item.status === "pending" ? (
            <Button disabled={importPending} onClick={onImport} size="sm">
              Importar para minha conta
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function ExternalExpensesEmpty({ searched, ignored }: { searched: boolean; ignored: boolean }) {
  return (
    <Card className="border-dashed shadow-none">
      <CardContent className="grid place-items-center py-14 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Check aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">
          {searched
            ? "Nenhum lançamento encontrado"
            : ignored
              ? "Nenhum lançamento ignorado"
              : "Nenhum lançamento pendente"}
        </p>
        <p className="mt-1 max-w-md text-muted-foreground text-sm">
          {searched
            ? "Tente buscar por outro estabelecimento, pessoa ou conta/cartão."
            : ignored
              ? "Os lançamentos ignorados neste mês aparecerão aqui e poderão ser restaurados."
              : "Novos lançamentos externos aparecerão aqui para importação."}
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
