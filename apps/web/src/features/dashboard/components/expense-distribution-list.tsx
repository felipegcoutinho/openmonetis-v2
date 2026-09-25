import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { MoneyValue } from "@/components/money-value";
import { Progress } from "@/components/ui/progress";
import type { TransactionsSearch } from "@/features/transactions/transactions.presentation";
import {
  formatDashboardTransactionCount,
  formatExpenseDistributionPercentage,
} from "../dashboard.presentation";
import { DashboardItemLinkArrow } from "./dashboard-item-link-arrow";
import { DashboardWidgetRow } from "./dashboard-widget-row";

export type ExpenseDistributionListItem = {
  amount: number;
  count: number;
  icon: ReactNode;
  key: string;
  label: string;
  percentage: number;
  search?: TransactionsSearch;
};

export function ExpenseDistributionList({ items }: { items: ExpenseDistributionListItem[] }) {
  return (
    <ol className="divide-y">
      {items.map((item) => (
        <DashboardWidgetRow key={item.key} structure="progress">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground [&>svg]:size-4">
            {item.icon}
          </span>
          <div className="grid min-w-0 flex-1 gap-2">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                {item.search ? (
                  <Link
                    className="group flex items-center gap-1 font-medium text-sm outline-none transition-transform duration-200 ease-out hover:translate-x-1 focus-visible:translate-x-1 motion-reduce:transition-none"
                    search={item.search}
                    to="/transactions"
                  >
                    <span className="truncate">{item.label}</span>
                    <DashboardItemLinkArrow />
                  </Link>
                ) : (
                  <span className="font-medium text-sm">{item.label}</span>
                )}
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {formatDashboardTransactionCount(item.count)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <MoneyValue amount={item.amount} className="font-medium text-sm" />
                <p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
                  {formatExpenseDistributionPercentage(item.percentage)}%
                </p>
              </div>
            </div>
            <Progress
              aria-label={`${item.label}: ${formatExpenseDistributionPercentage(item.percentage)}% das despesas`}
              indicatorClassName="bg-brand/70"
              trackClassName="h-1"
              value={Math.max(0, Math.min(100, item.percentage))}
            />
          </div>
        </DashboardWidgetRow>
      ))}
    </ol>
  );
}
