import type { RecurringExpenseOutput } from "@openmonetis/validators/recurring-expenses";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarX2,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  Repeat2,
  Square,
} from "lucide-react";
import { useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardWidget } from "@/features/dashboard/components/dashboard-widget";
import { DashboardWidgetEmptyState } from "@/features/dashboard/components/dashboard-widget-empty-state";
import { dashboardWidgetFooterNavigationLinkClassName } from "@/features/dashboard/components/dashboard-widget-footer-link";
import { DashboardWidgetListSheet } from "@/features/dashboard/components/dashboard-widget-list-sheet";
import { DashboardWidgetRow } from "@/features/dashboard/components/dashboard-widget-row";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import { cn } from "@/lib/utils";
import { recurringFrequencyLabels } from "../recurring-expenses.presentation";
import { recurringExpensesQueryOptions } from "../recurring-expenses.queries";
import { RecurringExpenseActionDialog } from "./recurring-expense-action-dialog";
import { RecurringExpenseEditDialog } from "./recurring-expense-edit-dialog";

const maximumVisibleExpenses = 5;

export function RecurringExpensesWidget({ period }: { period: string }) {
  const query = useQuery(recurringExpensesQueryOptions(period));
  const [listOpen, setListOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringExpenseOutput | null>(null);
  const [action, setAction] = useState<"pause" | "resume" | "skip" | "stop" | null>(null);
  const [actionExpense, setActionExpense] = useState<RecurringExpenseOutput | null>(null);
  const items = query.data?.items ?? [];
  const hiddenCount = Math.max(0, items.length - maximumVisibleExpenses);

  const rows = (expenses: RecurringExpenseOutput[]) => (
    <RecurringExpenseList
      items={expenses}
      onAction={(expense, nextAction) => {
        setActionExpense(expense);
        setAction(nextAction);
      }}
      onEdit={setEditing}
    />
  );

  return (
    <>
      <DashboardWidget
        description="Sua parte nas despesas recorrentes do mês"
        footer={
          items.length ? (
            <div className="flex items-center justify-between gap-3">
              {hiddenCount > 0 ? (
                <DashboardWidgetListSheet
                  description="Consulte e gerencie todas as despesas recorrentes deste mês."
                  onOpenChange={setListOpen}
                  open={listOpen}
                  title="Despesas recorrentes"
                  triggerLabel={`Ver mais ${hiddenCount} ${hiddenCount === 1 ? "despesa" : "despesas"}`}
                >
                  {rows(items)}
                </DashboardWidgetListSheet>
              ) : null}
              <Link
                className={dashboardWidgetFooterNavigationLinkClassName}
                search={{ period }}
                to="/reports/recurring-expenses"
              >
                Ver relatório <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
          ) : undefined
        }
        icon={<Repeat2 aria-hidden="true" />}
        title="Despesas recorrentes"
      >
        {query.isLoading ? <RecurringExpensesLoading /> : null}
        {query.isError ? (
          <div className="grid flex-1 place-items-center text-center">
            <div>
              <p className="font-medium text-sm">Não foi possível carregar as recorrências</p>
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
          items.length ? (
            rows(items.slice(0, maximumVisibleExpenses))
          ) : (
            <DashboardWidgetEmptyState
              description="As recorrências do mês aparecerão aqui."
              icon={<Repeat2 aria-hidden="true" />}
              title="Nenhuma recorrência neste mês"
            />
          )
        ) : null}
      </DashboardWidget>
      {editing ? (
        <RecurringExpenseEditDialog
          expense={editing}
          key={`${editing.id}:${editing.purchaseDate}`}
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          open
        />
      ) : null}
      <RecurringExpenseActionDialog
        action={action}
        expense={actionExpense}
        onOpenChange={(open) => {
          if (!open) {
            setAction(null);
            setActionExpense(null);
          }
        }}
      />
    </>
  );
}

function RecurringExpenseList({
  items,
  onAction,
  onEdit,
}: {
  items: RecurringExpenseOutput[];
  onAction: (expense: RecurringExpenseOutput, action: "pause" | "resume" | "skip" | "stop") => void;
  onEdit: (expense: RecurringExpenseOutput) => void;
}) {
  return (
    <ul className="divide-y">
      {items.map((item) => (
        <DashboardWidgetRow
          className={cn(item.status === "paused" && "-mx-2 rounded-md bg-muted/40 px-2")}
          key={`${item.id}:${item.purchaseDate}`}
        >
          <EstablishmentLogo className="size-9" name={item.name} size={36} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "truncate font-medium text-sm",
                  item.status === "paused" && "text-muted-foreground",
                )}
              >
                {item.name}
              </span>
            </div>
            <p className="truncate text-muted-foreground text-xs">
              {item.status === "paused" ? (
                "Pausada · pronta para retomar"
              ) : (
                <>
                  {recurringFrequencyLabels[item.frequency]} ·{" "}
                  {paymentMethodLabels[item.paymentMethod]}
                </>
              )}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <MoneyValue amount={item.amount} className="font-medium text-sm" />
            <p
              className={item.isSettled ? "text-success text-xs" : "text-muted-foreground text-xs"}
            >
              {item.status === "paused" ? "Inativa" : item.isSettled ? "Paga" : "Prevista"}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label={`Ações para ${item.name}`}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            >
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {item.status === "active" ? (
                <>
                  <DropdownMenuItem
                    disabled={!item.canEdit}
                    onClick={() => onEdit(item)}
                    title={!item.canEdit ? "Edite a divisão no lançamento original" : undefined}
                  >
                    <Pencil /> Alterar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction(item, "skip")}>
                    <CalendarX2 /> Pular este mês
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction(item, "pause")}>
                    <Pause /> Pausar recorrência
                  </DropdownMenuItem>
                </>
              ) : (
                <DropdownMenuItem onClick={() => onAction(item, "resume")}>
                  <Play /> Retomar recorrência
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => onAction(item, "stop")} variant="destructive">
                <Square /> Parar a partir deste mês
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </DashboardWidgetRow>
      ))}
    </ul>
  );
}

function RecurringExpensesLoading() {
  return (
    <div aria-label="Carregando despesas recorrentes" className="grid gap-3" role="status">
      {["first", "second", "third", "fourth"].map((key) => (
        <Skeleton className="h-16 w-full" key={key} />
      ))}
    </div>
  );
}
