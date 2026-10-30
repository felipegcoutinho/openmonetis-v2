import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type {
  AccountOutput,
  AddAccountYieldInput,
  AdjustAccountBalanceInput,
  ReplaceAccountInput,
} from "@openmonetis/validators/accounts";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { ArrowDownLeft, ArrowUpRight, History, Pencil, Scale, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EntityLoadError } from "@/components/entity-load-error";
import { FinancialDetailLoading } from "@/components/financial-detail-loading";
import {
  FinancialSummaryAction,
  FinancialSummaryBadge,
  FinancialSummaryHeader,
  FinancialSummaryTitleAction,
} from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Navbar } from "@/components/navigation/navbar";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { cn } from "@/lib/utils";
import {
  useAddAccountYieldMutation,
  useAdjustAccountBalanceMutation,
  useReplaceAccountMutation,
} from "../accounts.mutations";
import {
  accountTypeLabels,
  formatAccountBalanceLabel,
  isYieldAccountType,
} from "../accounts.presentation";
import { accountQueryOptions } from "../accounts.queries";
import { AccountCashFlow } from "./account-cash-flow";
import { AccountDialog } from "./account-dialog";
import { AddAccountYieldDialog } from "./add-account-yield-dialog";
import { AdjustAccountBalanceDialog } from "./adjust-account-balance-dialog";

type AccountStatementPageProps = {
  accountId: string;
  search: TransactionsSearch;
  onSearchChange: (search: Partial<TransactionsSearch>) => void;
};

export function AccountStatementPage({
  accountId,
  search,
  onSearchChange,
}: AccountStatementPageProps) {
  const selectedPeriod = search.period ?? getCurrentPeriodInBrazil();
  const accountQuery = useQuery(accountQueryOptions(accountId, selectedPeriod));
  const adjustBalanceMutation = useAdjustAccountBalanceMutation();
  const addYieldMutation = useAddAccountYieldMutation();
  const replaceMutation = useReplaceAccountMutation();
  const [adjustBalanceOpen, setAdjustBalanceOpen] = useState(false);
  const [addYieldOpen, setAddYieldOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const periodLabel = formatPeriod(selectedPeriod);
  useDocumentTitle(
    accountQuery.data ? `${accountQuery.data.name} · Extrato de ${periodLabel}` : undefined,
  );

  async function adjustBalance(input: AdjustAccountBalanceInput) {
    const result = await adjustBalanceMutation.mutateAsync({ id: accountId, input });
    setAdjustBalanceOpen(false);
    if (!result.adjustmentCreated) {
      toast.info("O saldo já estava com esse valor");
      return;
    }
    toast.success("Saldo ajustado", { description: "O lançamento de ajuste foi registrado." });
  }

  async function addYield(input: AddAccountYieldInput) {
    await addYieldMutation.mutateAsync({ id: accountId, input });
    setAddYieldOpen(false);
    toast.success("Rendimento adicionado", {
      description: "A receita foi registrada no extrato da conta.",
    });
  }

  // The account form already confirms the update with its own toast.
  async function saveAccount(input: ReplaceAccountInput) {
    await replaceMutation.mutateAsync({ id: accountId, input });
    setEditOpen(false);
  }

  function changePeriod(period: string) {
    onSearchChange({ period, dateStart: undefined, dateEnd: undefined, page: undefined });
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {accountQuery.isLoading ? <FinancialDetailLoading message="Carregando extrato" /> : null}
        {accountQuery.isError && !accountQuery.data ? (
          <EntityLoadError
            error={accountQuery.error}
            entity="a conta"
            onRetry={() => void accountQuery.refetch()}
          >
            <AccountStatementNotFound />
          </EntityLoadError>
        ) : null}
        {accountQuery.data ? (
          <>
            <TransactionsContainer
              onSearchChange={onSearchChange}
              scope={{
                accountIds: [accountQuery.data.id],
                allowCreate: !accountQuery.data.isArchived,
                createDefaults: {
                  accountId: accountQuery.data.id,
                  sourceAccountId: accountQuery.data.id,
                },
                header: {
                  breadcrumbs: [
                    { label: "Visão geral", href: "/dashboard" },
                    { label: "Finanças" },
                    { label: "Contas", href: "/accounts" },
                    { label: accountQuery.data.name },
                    { label: `Extrato de ${periodLabel}` },
                  ],
                  summary: (
                    <AccountStatementSummary
                      account={accountQuery.data}
                      isRefreshing={accountQuery.isPlaceholderData}
                      onAddYield={() => setAddYieldOpen(true)}
                      onAdjustBalance={() => setAdjustBalanceOpen(true)}
                      onEdit={() => setEditOpen(true)}
                      period={selectedPeriod}
                      periodLabel={periodLabel}
                    />
                  ),
                },
                adminSettledOnly: true,
                view: "accountStatement" as const,
                hiddenFilters: ["accountCard", "person", "settlement"] as const,
                contentNavigation: (
                  <AccountCashFlow
                    accountId={accountQuery.data.id}
                    onPeriodChange={changePeriod}
                    period={selectedPeriod}
                  />
                ),
                periodNavigationPlacement: "afterPageHeader" as const,
              }}
              search={search}
            />
            <AdjustAccountBalanceDialog
              account={accountQuery.data}
              onOpenChange={setAdjustBalanceOpen}
              onSubmit={adjustBalance}
              open={adjustBalanceOpen}
              period={selectedPeriod}
            />
            <AddAccountYieldDialog
              account={accountQuery.data}
              onOpenChange={setAddYieldOpen}
              onSubmit={addYield}
              open={addYieldOpen}
              period={selectedPeriod}
            />
            <AccountDialog
              account={accountQuery.data}
              onOpenChange={setEditOpen}
              onSubmit={saveAccount}
              open={editOpen}
            />
          </>
        ) : null}
      </main>
    </ProtectedRoute>
  );
}

function AccountStatementSummary({
  account,
  isRefreshing,
  onAddYield,
  onAdjustBalance,
  onEdit,
  period,
  periodLabel,
}: {
  account: AccountOutput;
  isRefreshing: boolean;
  onAddYield: () => void;
  onAdjustBalance: () => void;
  onEdit: () => void;
  period: string;
  periodLabel: string;
}) {
  const { summary } = account;
  const yieldFirst = isYieldAccountType(account.type);
  const canAdjustBalance = period <= getCurrentPeriodInBrazil();
  const yieldAction = (
    <FinancialSummaryAction
      primary={yieldFirst}
      disabled={isRefreshing}
      key="yield"
      onClick={onAddYield}
      type="button"
    >
      <TrendingUp aria-hidden="true" className="size-4" />
      Adicionar rendimento
    </FinancialSummaryAction>
  );
  const adjustAction = canAdjustBalance ? (
    <FinancialSummaryAction
      primary={!yieldFirst}
      disabled={isRefreshing}
      key="adjust"
      onClick={onAdjustBalance}
      type="button"
    >
      <Scale aria-hidden="true" className="size-4" />
      Ajustar saldo
    </FinancialSummaryAction>
  ) : null;

  return (
    <div
      aria-busy={isRefreshing}
      className={cn("transition-opacity", isRefreshing && "opacity-70")}
    >
      <FinancialSummaryHeader
        accentImage={account.logo}
        actions={
          account.isArchived ? (
            <p className="max-w-64 text-current/70 text-xs sm:text-right">
              Conta arquivada. Edite a conta para reativá-la e registrar movimentações.
            </p>
          ) : yieldFirst ? (
            [yieldAction, adjustAction]
          ) : (
            [adjustAction, yieldAction]
          )
        }
        eyebrow={`Extrato de ${periodLabel}`}
        identity={<AccountStatementIcon account={account} />}
        metrics={[
          {
            icon: <History aria-hidden="true" className="size-3.5" />,
            label: "Saldo anterior",
            value: <MoneyValue amount={summary.openingBalance} />,
          },
          {
            icon: <ArrowDownLeft aria-hidden="true" className="size-3.5" />,
            label: "Entradas",
            value: <MoneyValue amount={summary.income} />,
          },
          {
            icon: <ArrowUpRight aria-hidden="true" className="size-3.5" />,
            label: "Saídas",
            value: <MoneyValue amount={summary.expenses} />,
          },
        ]}
        primaryDescription={
          <span>
            Resultado do mês{" "}
            <MoneyValue amount={summary.netAmount} className="text-current" showPositiveSign />
          </span>
        }
        primaryLabel={formatAccountBalanceLabel(period)}
        primaryValue={<MoneyValue amount={summary.balance} />}
        subtitle={
          <>
            <span>{accountTypeLabels[account.type]}</span>
            {account.isArchived ? <FinancialSummaryBadge>Arquivada</FinancialSummaryBadge> : null}
          </>
        }
        title={account.name}
        titleAction={
          <FinancialSummaryTitleAction
            aria-label={`Editar conta ${account.name}`}
            onClick={onEdit}
            type="button"
          >
            <Pencil aria-hidden="true" className="size-3.5" />
          </FinancialSummaryTitleAction>
        }
      />
    </div>
  );
}

function AccountStatementIcon({ account }: { account: AccountOutput }) {
  if (!account.logo) {
    return (
      <span className="grid size-16 shrink-0 place-items-center rounded-full bg-current/10 font-semibold text-xl">
        {account.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
      </span>
    );
  }

  return (
    <Image
      alt=""
      className="size-16 shrink-0 rounded-full object-cover"
      height={64}
      layout="fixed"
      src={account.logo}
      width={64}
    />
  );
}

function AccountStatementNotFound() {
  return (
    <section className="app-page project-container">
      <p className="text-destructive text-sm" role="alert">
        Conta não encontrada.
      </p>
    </section>
  );
}
