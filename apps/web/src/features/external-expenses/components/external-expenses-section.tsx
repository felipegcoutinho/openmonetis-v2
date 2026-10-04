import type { ExternalExpenseOutput } from "@openmonetis/validators/external-expenses";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search, X } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { toast } from "sonner";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";

import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";

import {
  useImportExternalExpenseMutation,
  useReviewExternalExpenseMutation,
} from "../external-expenses.mutations";
import { externalExpensesQueryOptions } from "../external-expenses.queries";
import { createDefaultsFor } from "./external-expense-defaults";
import { ExternalExpensesEmpty } from "./external-expenses-empty";
import { ExternalExpensesLoading } from "./external-expenses-loading";
import type { ExternalExpenseSort } from "./external-expenses-section.types";
import { externalExpenseSortLabels } from "./external-expenses-section-options";
import { ExternalExpensesSummary } from "./external-expenses-summary";
import { ExternalExpensesTable } from "./external-expenses-table";

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
