import type { DashboardPaymentStatusOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, RefreshCw, WalletCards } from "lucide-react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getPaymentStatusPercentage } from "../dashboard.presentation";
import { dashboardPaymentStatusQueryOptions } from "../dashboard.queries";
import { useAdminPersonSlug } from "../useAdminPersonSlug";
import { DashboardWidget } from "./dashboard-widget";
import { DashboardWidgetEmptyState } from "./dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";

type PaymentStatusCategory = DashboardPaymentStatusOutput["income"];

export function PaymentStatusWidget({ period }: { period: string }) {
  const query = useQuery(dashboardPaymentStatusQueryOptions(period));
  const adminPersonSlug = useAdminPersonSlug();
  const isEmpty = query.data?.income.total === 0 && query.data.expenses.total === 0;

  return (
    <DashboardWidget
      description="Sua parte nos valores recebidos, pagos e pendentes"
      footer={
        query.data && !isEmpty && adminPersonSlug ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ people: adminPersonSlug, period }}
            to="/transactions"
          >
            Ver lançamentos <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<WalletCards aria-hidden="true" />}
      title="Status de pagamento"
    >
      {query.isLoading ? <PaymentStatusLoading /> : null}
      {query.isError ? (
        <div className="grid flex-1 place-items-center text-center">
          <div>
            <p className="font-medium text-sm">Não foi possível carregar os pagamentos</p>
            <Button
              className="mt-3"
              onClick={() => void query.refetch()}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </div>
        </div>
      ) : null}
      {query.data && !query.isError ? (
        isEmpty ? (
          <DashboardWidgetEmptyState
            description="Os valores do mês aparecerão aqui."
            icon={<WalletCards aria-hidden="true" />}
            title="Nenhum valor a receber ou pagar"
          />
        ) : (
          <div aria-busy={query.isFetching} className="grid flex-1 content-center gap-7">
            <PaymentStatusSection
              adminPersonSlug={adminPersonSlug}
              category={query.data.income}
              period={period}
              type="income"
            />
            <div className="border-t" />
            <PaymentStatusSection
              adminPersonSlug={adminPersonSlug}
              category={query.data.expenses}
              period={period}
              type="expenses"
            />
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function PaymentStatusSection({
  adminPersonSlug,
  period,
  category,
  type,
}: {
  adminPersonSlug?: string;
  period: string;
  category: PaymentStatusCategory;
  type: "expenses" | "income";
}) {
  const isIncome = type === "income";
  const percentage = getPaymentStatusPercentage(category.confirmed, category.total);
  const roundedPercentage = Math.round(percentage);
  const Icon = isIncome ? ArrowDownLeft : ArrowUpRight;
  const title = isIncome ? "Receitas do mês" : "Despesas do mês";
  const confirmedLabel = isIncome ? "Recebido" : "Pago";
  const pendingLabel = isIncome ? "Falta receber" : "Falta pagar";

  return (
    <section aria-label={title} className="grid gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-md bg-muted text-muted-foreground">
            <Icon aria-hidden="true" className="size-3.5" />
          </span>
          <div>
            <h3 className="font-medium text-sm">{title}</h3>
            <p className="text-muted-foreground text-xs">
              {roundedPercentage}% {isIncome ? "recebido" : "pago"}
            </p>
          </div>
        </div>
        <MoneyValue amount={category.total} className="font-medium text-sm" />
      </div>

      <Progress
        aria-label={`${roundedPercentage}% ${isIncome ? "recebido" : "pago"}`}
        indicatorClassName="bg-success"
        trackClassName="bg-warning/25"
        value={percentage}
      />

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="min-w-0">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-success" />
            {confirmedLabel}
          </span>
          <MoneyValue amount={category.confirmed} className="mt-1 font-medium text-sm" />
        </div>
        <div className="min-w-0 text-right">
          <span className="flex items-center justify-end gap-1.5 text-muted-foreground">
            <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
            {pendingLabel}
          </span>
          {adminPersonSlug ? (
            <Link
              aria-label={`Ver valores ${isIncome ? "a receber" : "a pagar"}`}
              className="inline-flex rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring"
              search={{
                people: adminPersonSlug,
                period,
                settlement: "unpaid",
                type: isIncome ? "income" : "expense",
              }}
              to="/transactions"
            >
              <MoneyValue amount={category.pending} className="mt-1 font-medium text-sm" />
            </Link>
          ) : (
            <MoneyValue amount={category.pending} className="mt-1 font-medium text-sm" />
          )}
        </div>
      </div>
    </section>
  );
}

function PaymentStatusLoading() {
  return (
    <div
      aria-label="Carregando status de pagamento"
      className="grid flex-1 content-center gap-7"
      role="status"
    >
      {["income", "expenses"].map((key) => (
        <div className="grid gap-3" key={key}>
          <div className="flex items-center justify-between">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-1.5 w-full" />
          <div className="flex justify-between">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
