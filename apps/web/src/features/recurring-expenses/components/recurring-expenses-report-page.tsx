import type { RecurringExpensesReportOutput } from "@openmonetis/validators/recurring-expenses";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Barcode,
  CalendarDays,
  CalendarX2,
  CreditCard,
  Landmark,
  type LucideIcon,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  QrCode,
  RefreshCw,
  Repeat2,
  Square,
  Ticket,
} from "lucide-react";
import { useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { MonthNavigation } from "@/components/month-navigation";
import { Navbar } from "@/components/navigation/navbar";
import { PageHeader } from "@/components/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/features/categories/category-icons";
import { formatDashboardPeriod } from "@/features/dashboard/dashboard.presentation";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { paymentMethodLabels } from "@/features/transactions/transactions.presentation";
import {
  formatRecurringExpenseDate,
  recurringFrequencyLabels,
} from "../recurring-expenses.presentation";
import { recurringExpensesReportQueryOptions } from "../recurring-expenses.queries";
import { RecurringExpenseActionDialog } from "./recurring-expense-action-dialog";
import { RecurringExpenseEditDialog } from "./recurring-expense-edit-dialog";

type ReportItem = RecurringExpensesReportOutput["items"][number];

export function RecurringExpensesReportPage({
  onPeriodChange,
  period,
}: {
  onPeriodChange: (period: string) => void;
  period: string;
}) {
  const reportQuery = useQuery(recurringExpensesReportQueryOptions(period));
  const [editing, setEditing] = useState<ReportItem | null>(null);
  const [action, setAction] = useState<"pause" | "resume" | "skip" | "stop" | null>(null);
  const [actionExpense, setActionExpense] = useState<ReportItem | null>(null);
  const report = reportQuery.data;

  function chooseAction(expense: ReportItem, nextAction: NonNullable<typeof action>) {
    setActionExpense(expense);
    setAction(nextAction);
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        <section className="app-page project-container">
          <PageHeader
            breadcrumbs={[
              { label: "Visão geral", href: "/dashboard" },
              { label: "Relatórios" },
              { label: "Despesas recorrentes" },
            ]}
            description="Acompanhe os compromissos recorrentes da pessoa administradora e gerencie cada regra com clareza."
            icon={<Repeat2 aria-hidden="true" className="size-5" />}
            title="Despesas recorrentes"
          />

          <MonthNavigation onPeriodChange={onPeriodChange} period={period} />

          {reportQuery.isLoading ? <RecurringExpensesReportSkeleton /> : null}
          {reportQuery.isError ? (
            <Card className="grid min-h-56 place-items-center p-6 text-center">
              <div>
                <p className="font-medium">Não foi possível carregar as despesas recorrentes</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Verifique sua conexão e tente novamente.
                </p>
                <Button
                  className="mt-4"
                  onClick={() => void reportQuery.refetch()}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <RefreshCw aria-hidden="true" /> Tentar novamente
                </Button>
              </div>
            </Card>
          ) : null}
          {report && !reportQuery.isError ? (
            <div aria-busy={reportQuery.isFetching} className="grid gap-6">
              <FinancialSummaryHeader
                eyebrow={`Previsão de ${formatDashboardPeriod(period, true)}`}
                identity={
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
                    <Repeat2 aria-hidden="true" className="size-6" />
                  </span>
                }
                metrics={[
                  {
                    icon: <Play aria-hidden="true" className="size-3.5" />,
                    label: "Recorrências ativas",
                    value: report.summary.activeCount,
                  },
                  {
                    icon: <Pause aria-hidden="true" className="size-3.5" />,
                    label: "Recorrências pausadas",
                    value: report.summary.pausedCount,
                  },
                ]}
                primaryLabel="Total previsto no mês"
                primaryValue={<MoneyValue amount={report.summary.projectedTotal} />}
                subtitle="Compromissos recorrentes da pessoa administradora"
                title="Despesas recorrentes"
                variant="soft"
              />

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Projeção dos próximos meses</CardTitle>
                  <CardDescription>
                    Valores previstos pela data da recorrência, sem materializar lançamentos
                    futuros.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-3">
                  {report.projections.map((projection) => (
                    <div className="rounded-lg border bg-muted/20 p-4" key={projection.period}>
                      <p className="text-muted-foreground text-sm">
                        {formatDashboardPeriod(projection.period)}
                      </p>
                      <MoneyValue amount={projection.total} className="mt-1 text-xl" />
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Regras recorrentes</CardTitle>
                  <CardDescription>
                    {report.items.length} regra{report.items.length === 1 ? "" : "s"} vinculada
                    {report.items.length === 1 ? "" : "s"} à pessoa administradora.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {report.items.length ? (
                    <ul className="divide-y">
                      {report.items.map((item) => (
                        <RecurringExpenseReportRow
                          key={item.id}
                          item={item}
                          onAction={chooseAction}
                          onEdit={setEditing}
                        />
                      ))}
                    </ul>
                  ) : (
                    <div className="grid min-h-40 place-items-center text-center">
                      <div>
                        <p className="font-medium">Nenhuma recorrência ativa neste período</p>
                        <p className="mt-1 text-muted-foreground text-sm">
                          As despesas recorrentes da pessoa administradora aparecerão aqui.
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}
        </section>
      </main>
      {editing ? (
        <RecurringExpenseEditDialog
          expense={editing}
          key={`${editing.id}:${editing.purchaseDate}`}
          onOpenChange={(open) => !open && setEditing(null)}
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
    </ProtectedRoute>
  );
}

function RecurringExpenseReportRow({
  item,
  onAction,
  onEdit,
}: {
  item: ReportItem;
  onAction: (expense: ReportItem, action: "pause" | "resume" | "skip" | "stop") => void;
  onEdit: (expense: ReportItem) => void;
}) {
  const PaymentIcon = recurringPaymentMethodIcons[item.paymentMethod];
  const canManage = Boolean(item.actionDate);

  return (
    <li className="flex flex-wrap items-center gap-3 py-4 sm:flex-nowrap">
      <EstablishmentLogo editable={false} name={item.name} size={40} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{item.name}</p>
          <Badge className="gap-1.5" variant={item.status === "active" ? "secondary" : "outline"}>
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${item.status === "active" ? "bg-success" : "bg-muted-foreground"}`}
            />
            {item.status === "active" ? "Ativa" : "Pausada"}
          </Badge>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
          <span className="inline-flex items-center gap-1.5">
            <Repeat2 aria-hidden="true" className="size-3.5" />
            {recurringFrequencyLabels[item.frequency]}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <PaymentIcon aria-hidden="true" className="size-3.5" />
            {paymentMethodLabels[item.paymentMethod]}
            <RecurringDestination item={item} />
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="grid size-5 place-items-center rounded-full bg-muted">
              <CategoryIcon className="size-3" name={item.categoryIcon} />
            </span>
            {item.categoryName ?? "Sem categoria"}
          </span>
          <RecurringPeople item={item} />
        </div>
        <p className="mt-1.5 inline-flex items-center gap-1.5 text-muted-foreground text-xs">
          <CalendarDays aria-hidden="true" className="size-3.5" />
          {item.status === "paused"
            ? "Sem lançamentos enquanto estiver pausada"
            : item.nextOccurrenceDate
              ? `Próxima ocorrência: ${formatRecurringExpenseDate(item.nextOccurrenceDate)}`
              : "Nenhum próximo lançamento encontrado"}
        </p>
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
        <MoneyValue amount={item.amount} className="mr-1 font-semibold" />
        {item.status === "paused" ? (
          <Button
            disabled={!canManage}
            onClick={() => onAction(item, "resume")}
            size="sm"
            type="button"
            variant="outline"
          >
            <Play aria-hidden="true" /> Retomar
          </Button>
        ) : null}
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
                <DropdownMenuItem disabled={!canManage} onClick={() => onEdit(item)}>
                  <Pencil /> Alterar
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canManage} onClick={() => onAction(item, "skip")}>
                  <CalendarX2 /> Pular próximo lançamento
                </DropdownMenuItem>
                <DropdownMenuItem disabled={!canManage} onClick={() => onAction(item, "pause")}>
                  <Pause /> Pausar recorrência
                </DropdownMenuItem>
              </>
            ) : (
              <DropdownMenuItem disabled={!canManage} onClick={() => onAction(item, "resume")}>
                <Play /> Retomar recorrência
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              disabled={!canManage}
              onClick={() => onAction(item, "stop")}
              variant="destructive"
            >
              <Square /> Parar recorrência
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}

const recurringPaymentMethodIcons = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: Ticket,
  bank_transfer: Landmark,
} satisfies Record<ReportItem["paymentMethod"], LucideIcon>;

function RecurringDestination({ item }: { item: ReportItem }) {
  const isCard = Boolean(item.cardName);
  const name = item.cardName ?? item.accountName;
  const logo = item.cardLogo ?? item.accountLogo;
  if (!name) return null;

  const DestinationIcon = isCard ? CreditCard : Landmark;
  return (
    <>
      <span aria-hidden="true">·</span>
      <Avatar className="size-5" title={isCard ? `Cartão ${name}` : `Conta ${name}`}>
        <AvatarImage alt="" src={logo ?? undefined} />
        <AvatarFallback>
          <DestinationIcon aria-hidden="true" className="size-3" />
        </AvatarFallback>
      </Avatar>
      <span>{name}</span>
    </>
  );
}

function RecurringPeople({ item }: { item: ReportItem }) {
  if (!item.splitPeople.length) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className="size-5">
          <AvatarImage
            alt={`Avatar de ${item.personName}`}
            src={item.personAvatarUrl ?? undefined}
          />
          <AvatarFallback className="text-[9px]">
            {item.personName.slice(0, 1).toLocaleUpperCase("pt-BR")}
          </AvatarFallback>
        </Avatar>
        {item.personName}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={item.splitPeople.map((person) => person.name).join(", ")}
    >
      <span className="inline-flex shrink-0 -space-x-2">
        {item.splitPeople.slice(0, 3).map((person) => (
          <Avatar key={person.id} showBorder={false} size="sm">
            <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
            <AvatarFallback>{person.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</AvatarFallback>
          </Avatar>
        ))}
        {item.splitPeople.length > 3 ? (
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
            <span aria-hidden="true">+{item.splitPeople.length - 3}</span>
            <span className="sr-only">Mais {item.splitPeople.length - 3} pessoas</span>
          </span>
        ) : null}
      </span>
      {item.splitPeople.length} pessoas
    </span>
  );
}

function RecurringExpensesReportSkeleton() {
  return (
    <div className="grid gap-6">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-40" />
      <Skeleton className="h-96" />
    </div>
  );
}
