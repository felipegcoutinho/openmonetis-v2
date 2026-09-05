import type {
  AccountOutput,
  AddAccountYieldInput,
  AdjustAccountBalanceInput,
} from "@openmonetis/validators/accounts";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { CircleCheck, Landmark, Scale, TrendingUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ProtectedRoute } from "@/components/auth/protected-route";
import {
  FinancialSummaryAction,
  FinancialSummaryHeader,
} from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { Navbar } from "@/components/navigation/navbar";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  getCurrentPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { useAddAccountYieldMutation, useAdjustAccountBalanceMutation } from "../accounts.mutations";
import { accountTypeLabels } from "../accounts.presentation";
import { accountQueryOptions } from "../accounts.queries";
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
  const [adjustBalanceOpen, setAdjustBalanceOpen] = useState(false);
  const [addYieldOpen, setAddYieldOpen] = useState(false);

  async function adjustBalance(input: AdjustAccountBalanceInput) {
    await adjustBalanceMutation.mutateAsync({ id: accountId, input });
    setAdjustBalanceOpen(false);
    toast.success("Saldo ajustado", { description: "O lançamento de ajuste foi registrado." });
  }

  async function addYield(input: AddAccountYieldInput) {
    await addYieldMutation.mutateAsync({ id: accountId, input });
    setAddYieldOpen(false);
    toast.success("Rendimento adicionado", {
      description: "A receita foi registrada no extrato da conta.",
    });
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {accountQuery.isLoading ? <AccountStatementLoading /> : null}
        {accountQuery.isError ? <AccountStatementNotFound /> : null}
        {accountQuery.data ? (
          <>
            <TransactionsContainer
              onSearchChange={onSearchChange}
              scope={getAccountStatementScope(
                accountQuery.data,
                selectedPeriod,
                () => setAdjustBalanceOpen(true),
                () => setAddYieldOpen(true),
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
  periodLabel,
}: {
  account: AccountOutput;
  onAddYield: () => void;
  onAdjustBalance: () => void;
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
            <FinancialSummaryAction onClick={onAdjustBalance} type="button">
              <Scale aria-hidden="true" className="size-4" />
              Ajustar saldo
            </FinancialSummaryAction>
          </>
        ) : undefined
      }
      eyebrow={`Extrato de ${periodLabel}`}
      identity={<AccountStatementIcon account={account} />}
      metrics={[
        {
          icon: <Landmark aria-hidden="true" className="size-3.5" />,
          label: "Entradas",
          value: <MoneyValue amount={account.summary.income} />,
        },
        {
          icon: <CircleCheck aria-hidden="true" className="size-3.5" />,
          label: "Saídas",
          value: <MoneyValue amount={account.summary.expenses} />,
        },
      ]}
      primaryLabel="Saldo atual"
      primaryValue={<MoneyValue amount={account.summary.balance} />}
      subtitle={accountTypeLabels[account.type]}
      title={account.name}
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
