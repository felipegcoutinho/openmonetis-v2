import type { DashboardExpenseDistributionOutput } from "@openmonetis/validators/dashboard";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeDollarSign,
  Banknote,
  Barcode,
  CreditCard,
  Landmark,
  type LucideIcon,
  QrCode,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import { dashboardExpenseDistributionQueryOptions } from "../dashboard.queries";
import { DashboardWidget } from "./dashboard-widget";
import { dashboardWidgetFooterNavigationLinkClassName } from "./dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "./dashboard-widget-list-sheet";
import {
  ExpenseDistributionList,
  type ExpenseDistributionListItem,
} from "./expense-distribution-list";
import {
  DistributionEmpty,
  DistributionError,
  DistributionLoading,
} from "./expense-distribution-states";

type PaymentMethod = DashboardExpenseDistributionOutput["paymentMethods"][number]["key"];
const maximumVisiblePaymentMethods = 4;

const paymentMethodIcons: Record<PaymentMethod, LucideIcon> = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: BadgeDollarSign,
  bank_transfer: Landmark,
};

export function PaymentMethodsWidget({ period }: { period: string }) {
  const [isListOpen, setIsListOpen] = useState(false);
  const query = useQuery(dashboardExpenseDistributionQueryOptions(period));
  const items = query.data ? buildItems(query.data.paymentMethods, period) : [];
  const visibleItems = items.slice(0, maximumVisiblePaymentMethods);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);

  return (
    <DashboardWidget
      description="Meios usados nas despesas do mês"
      footer={
        items.length > 0 ? (
          <div className="flex items-center justify-between gap-3">
            {hiddenCount > 0 ? (
              <DashboardWidgetListSheet
                description="Participação de cada forma no total de despesas do mês."
                onOpenChange={setIsListOpen}
                open={isListOpen}
                title="Formas de pagamento"
                triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "forma" : "formas"}`}
              >
                <ExpenseDistributionList items={items} />
              </DashboardWidgetListSheet>
            ) : (
              <span />
            )}
            <Link
              className={dashboardWidgetFooterNavigationLinkClassName}
              search={{ period, type: "expense" }}
              to="/transactions"
            >
              Ver despesas <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        ) : undefined
      }
      icon={<WalletCards aria-hidden="true" />}
      title="Formas de pagamento"
    >
      {query.isLoading ? <DistributionLoading /> : null}
      {query.isError ? <DistributionError onRetry={() => void query.refetch()} /> : null}
      {query.data && !query.isError ? (
        items.length === 0 ? (
          <DistributionEmpty />
        ) : (
          <div aria-busy={query.isFetching} className="flex flex-1 flex-col">
            <ExpenseDistributionList items={visibleItems} />
          </div>
        )
      ) : null}
    </DashboardWidget>
  );
}

function buildItems(
  paymentMethods: DashboardExpenseDistributionOutput["paymentMethods"],
  period: string,
): ExpenseDistributionListItem[] {
  return paymentMethods.map((paymentMethod) => {
    const Icon = paymentMethodIcons[paymentMethod.key];

    return {
      ...paymentMethod,
      icon: <Icon aria-hidden="true" />,
      label: paymentMethodLabels[paymentMethod.key],
      search: { paymentMethod: paymentMethod.key, period, type: "expense" },
    };
  });
}
