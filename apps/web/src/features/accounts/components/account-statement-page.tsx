import type {
  AccountOutput,
  AddAccountYieldInput,
  AdjustAccountBalanceInput,
  CreateAccountInput,
  ReplaceAccountInput,
} from "@openmonetis/validators/accounts";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { ArrowDownLeft, ArrowUpRight, Pencil, Scale, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { EntityLoadError } from "@/components/entity-load-error";
import {
  FinancialSummaryAction,
  FinancialSummaryHeader,
  FinancialSummaryTitleAction,
} from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Navbar } from "@/components/navigation/navbar";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  getCurrentPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import {
  useAddAccountYieldMutation,
  useAdjustAccountBalanceMutation,
  useReplaceAccountMutation,
} from "../accounts.mutations";
import { accountTypeLabels } from "../accounts.presentation";
import { accountQueryOptions } from "../accounts.queries";
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
  const selectedPeriod = search.period ?? getCurrentPeriod();
  const accountQuery = useQuery(accountQueryOptions(accountId, selectedPeriod));
  const adjustBalanceMutation = useAdjustAccountBalanceMutation();
  const addYieldMutation = useAddAccountYieldMutation();
  const replaceMutation = useReplaceAccountMutation();
  const [adjustBalanceOpen, setAdjustBalanceOpen] = useState(false);
  const [addYieldOpen, setAddYieldOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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

  async function saveAccount(input: CreateAccountInput | ReplaceAccountInput) {
    await replaceMutation.mutateAsync({ id: accountId, input: input as ReplaceAccountInput });
    setEditOpen(false);
    toast.success("Conta atualizada");
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {accountQuery.isLoading ? <AccountStatementLoading /> : null}
        {accountQuery.isError ? (
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
              scope={getAccountStatementScope(
                accountQuery.data,
                selectedPeriod,
                () => setAdjustBalanceOpen(true),
                () => setAddYieldOpen(true),
                () => setEditOpen(true),
              )}
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

function getAccountStatementScope(
  account: AccountOutput,
  period: string,
  onAdjustBalance: () => void,
  onAddYield: () => void,
  onEdit: () => void,
) {
  const periodLabel = formatPeriod(period);

  return {
    accountIds: [account.id],
    allowCreate: !account.isArchived,
    createDefaults: {
      accountId: account.id,
      sourceAccountId: account.id,
    },
    header: {
      breadcrumbs: [
        { label: "Visão geral", href: "/dashboard" },
        { label: "Finanças" },
        { label: "Contas", href: "/accounts" },
        { label: account.name },
        { label: `Extrato de ${periodLabel}` },
      ],
      summary: (
        <AccountStatementSummary
          account={account}
          onAddYield={onAddYield}
          onAdjustBalance={onAdjustBalance}
          onEdit={onEdit}
          period={period}
          periodLabel={periodLabel}
        />
      ),
    },
    adminSettledOnly: true,
    hiddenFilters: ["accountCard", "person", "settlement"] as const,
    periodNavigationPlacement: "afterPageHeader" as const,
  };
}

function AccountStatementSummary({
  account,
  onAddYield,
  onAdjustBalance,
  onEdit,
  period,
  periodLabel,
}: {
  account: AccountOutput;
  onAddYield: () => void;
  onAdjustBalance: () => void;
  onEdit: () => void;
  period: string;
  periodLabel: string;
}) {
  return (
    <FinancialSummaryHeader
      accentImage={account.logo}
      actions={
        !account.isArchived ? (
          <>
            <FinancialSummaryAction onClick={onAddYield} type="button">
              <TrendingUp aria-hidden="true" className="size-4" />
              Adicionar rendimento
            </FinancialSummaryAction>
            {period <= getCurrentPeriod() ? (
              <FinancialSummaryAction onClick={onAdjustBalance} type="button">
                <Scale aria-hidden="true" className="size-4" />
                Ajustar saldo
              </FinancialSummaryAction>
            ) : null}
          </>
        ) : undefined
      }
      eyebrow={`Extrato de ${periodLabel}`}
      identity={<AccountStatementIcon account={account} />}
      metrics={[
        {
          icon: <ArrowDownLeft aria-hidden="true" className="size-3.5" />,
          label: "Entradas",
          value: <MoneyValue amount={account.summary.income} />,
        },
        {
          icon: <ArrowUpRight aria-hidden="true" className="size-3.5" />,
          label: "Saídas",
          value: <MoneyValue amount={account.summary.expenses} />,
        },
      ]}
      primaryLabel={`Saldo acumulado até ${periodLabel}`}
      primaryValue={<MoneyValue amount={account.summary.balance} />}
      subtitle={accountTypeLabels[account.type]}
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
  );
}

function AccountStatementIcon({ account }: { account: AccountOutput }) {
  if (!account.logo) {
    return (
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10 font-semibold text-lg">
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

function AccountStatementLoading() {
  return (
    <section className="app-page project-container">
      <p className="text-muted-foreground text-sm">Carregando extrato...</p>
    </section>
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
