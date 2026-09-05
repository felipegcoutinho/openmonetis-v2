import type { DashboardWidgetId } from "@openmonetis/domain/dashboard";
import {
  BarChart3,
  BookOpenText,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  FileClock,
  FolderKanban,
  HandCoins,
  Landmark,
  type LucideIcon,
  PieChart,
  ReceiptText,
  RefreshCcw,
  Tags,
  Users,
  WalletCards,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import { BillsWidget } from "@/features/bills/components/bills-widget";
import { BudgetsWidget } from "@/features/budgets/components/budgets-widget";
import { CategoryTrendsWidget } from "@/features/category-trends/components/category-trends-widget";
import { InboxWidget } from "@/features/inbox/components/inbox-widget";
import { InstallmentExpensesWidget } from "@/features/installments/components/installment-expenses-widget";
import { InvoicesWidget } from "@/features/invoices/components/invoices-widget";
import { NotesWidget } from "@/features/notes/components/notes-widget";
import { PersonSettlementsWidget } from "@/features/person-settlements/components/person-settlements-widget";
import { RecurringExpensesWidget } from "@/features/recurring-expenses/components/recurring-expenses-widget";
import { CategoryBreakdownWidget } from "./category-breakdown-widget";
import { CategoryTransactionsWidget } from "./category-transactions-widget";
import { IncomeExpenseBalanceWidget } from "./income-expense-balance-widget";
import { MyAccountsWidget } from "./my-accounts-widget";
import { PaymentConditionsWidget } from "./payment-conditions-widget";
import { PaymentMethodsWidget } from "./payment-methods-widget";
import { PaymentStatusWidget } from "./payment-status-widget";
import { PeopleWidget } from "./people-widget";

export type DashboardWidgetDefinition = {
  description: string;
  icon: LucideIcon;
  id: DashboardWidgetId;
  render: (period: string) => ReactNode;
  title: string;
};

export const dashboardWidgetRegistry: readonly DashboardWidgetDefinition[] = [
  {
    id: "accounts",
    title: "Minhas contas",
    description: "Saldos disponíveis e consolidado",
    icon: Landmark,
    render: (period) => <MyAccountsWidget period={period} />,
  },
  {
    id: "invoices",
    title: "Faturas",
    description: "Resumo das faturas do período",
    icon: CreditCard,
    render: (period) => <InvoicesWidget period={period} />,
  },
  {
    id: "bills",
    title: "Boletos",
    description: "Vencimentos e pagamentos do período",
    icon: ReceiptText,
    render: (period) => <BillsWidget period={period} />,
  },
  {
    id: "payment-status",
    title: "Status de pagamento",
    description: "Valores confirmados e pendentes",
    icon: CircleDollarSign,
    render: (period) => <PaymentStatusWidget period={period} />,
  },
  {
    id: "inbox",
    title: "Caixa de entrada",
    description: "Capturas e itens pendentes de revisão",
    icon: FileClock,
    render: () => <InboxWidget />,
  },
  {
    id: "person-settlements",
    title: "Acertos por pessoas",
    description: "Valores a receber e créditos do mês",
    icon: HandCoins,
    render: (period) => <PersonSettlementsWidget period={period} />,
  },
  {
    id: "income-expense-balance",
    title: "Receitas, despesas e resultado",
    description: "Evolução dos últimos seis meses",
    icon: ChartNoAxesCombined,
    render: (period) => <IncomeExpenseBalanceWidget period={period} />,
  },
  {
    id: "budgets",
    title: "Orçamentos",
    description: "Progresso por categoria no período",
    icon: FolderKanban,
    render: (period) => <BudgetsWidget period={period} />,
  },
  {
    id: "category-trends",
    title: "Tendências de categorias",
    description: "Maiores variações contra o mês anterior",
    icon: BarChart3,
    render: (period) => <CategoryTrendsWidget period={period} />,
  },
  {
    id: "expense-categories",
    title: "Despesas por categoria",
    description: "Distribuição das despesas do período",
    icon: PieChart,
    render: (period) => <CategoryBreakdownWidget period={period} variant="expense" />,
  },
  {
    id: "income-categories",
    title: "Receitas por categoria",
    description: "Distribuição das receitas do período",
    icon: PieChart,
    render: (period) => <CategoryBreakdownWidget period={period} variant="income" />,
  },
  {
    id: "category-transactions",
    title: "Lançamentos por categoria",
    description: "Categorias com maior movimentação",
    icon: Tags,
    render: (period) => <CategoryTransactionsWidget period={period} />,
  },
  {
    id: "people",
    title: "Pessoas",
    description: "Despesas por pessoa no período",
    icon: Users,
    render: (period) => <PeopleWidget period={period} />,
  },
  {
    id: "payment-conditions",
    title: "Condições de pagamento",
    description: "À vista, parceladas e recorrentes",
    icon: Waypoints,
    render: (period) => <PaymentConditionsWidget period={period} />,
  },
  {
    id: "payment-methods",
    title: "Formas de pagamento",
    description: "Distribuição por meio de pagamento",
    icon: WalletCards,
    render: (period) => <PaymentMethodsWidget period={period} />,
  },
  {
    id: "installments",
    title: "Lançamentos parcelados",
    description: "Parcelas abertas e andamento",
    icon: CalendarClock,
    render: (period) => <InstallmentExpensesWidget period={period} />,
  },
  {
    id: "recurring-expenses",
    title: "Lançamentos recorrentes",
    description: "Compromissos recorrentes do período",
    icon: RefreshCcw,
    render: (period) => <RecurringExpensesWidget period={period} />,
  },
  {
    id: "notes",
    title: "Anotações",
    description: "Anotações ativas mais recentes",
    icon: BookOpenText,
    render: () => <NotesWidget />,
  },
] as const;

export const dashboardWidgetById = new Map(
  dashboardWidgetRegistry.map((widget) => [widget.id, widget]),
);
