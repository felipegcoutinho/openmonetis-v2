import type { DashboardExpenseDistributionOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleDollarSign, Layers3, type LucideIcon, Repeat2 } from "lucide-react";
import { transactionConditionLabels } from "@/features/transactions/transactions.presentation";
import { dashboardExpenseDistributionQueryOptions } from "../dashboard.queries";
import { DashboardWidget } from "./dashboard-widget";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import {
  ExpenseDistributionList,
  type ExpenseDistributionListItem,
} from "./expense-distribution-list";
import {
  DistributionEmpty,
  DistributionError,
  DistributionLoading,
} from "./expense-distribution-states";

type Condition = DashboardExpenseDistributionOutput["conditions"][number]["key"];

const conditionIcons: Record<Condition, LucideIcon> = {
  single: CircleDollarSign,
  installment: Layers3,
  recurring: Repeat2,
};

export function PaymentConditionsWidget({ period }: { period: string }) {
  const query = useQuery(dashboardExpenseDistributionQueryOptions(period));
  const items = query.data ? buildItems(query.data.conditions, period) : [];

  return (
    <DashboardWidget
      description="Despesas à vista, parceladas e recorrentes"
      footer={
        items.length > 0 ? (
          <Link
            className={dashboardWidgetFooterNavigationLinkClassName}
            search={{ period, type: "expense" }}
            to="/transactions"
          >
            Ver despesas <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        ) : undefined
      }
      icon={<Layers3 aria-hidden="true" />}
      title="Condições de pagamento"
    >
      {query.isLoading ? <DistributionLoading /> : null}
      {query.isError ? <DistributionError onRetry={() => void query.refetch()} /> : null}
      {query.data && !query.isError ? (
        items.length === 0 ? (
          <DistributionEmpty />
        ) : (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <ExpenseDistributionList items={items} />
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function buildItems(
  conditions: DashboardExpenseDistributionOutput["conditions"],
  period: string,
): ExpenseDistributionListItem[] {
  return conditions.map((condition) => {
    const Icon = conditionIcons[condition.key];

    return {
      ...condition,
      icon: <Icon aria-hidden="true" />,
      label: transactionConditionLabels[condition.key],
      search: { condition: condition.key, period, type: "expense" },
    };
  });
}
