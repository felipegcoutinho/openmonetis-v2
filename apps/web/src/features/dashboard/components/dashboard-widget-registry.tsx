import type { DashboardWidgetId } from "@openmonetis/domain/dashboard";
import {
  BellRing,
  BookOpenText,
  CalendarClock,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  FileClock,
  FolderKanban,
  Gauge,
  Goal,
  HandCoins,
  Landmark,
  type LucideIcon,
  PieChart,
  ReceiptText,
  RefreshCcw,
  Tags,
  Target,
  Users,
  WalletCards,
  Waypoints,
} from "lucide-react";
import type { ReactNode } from "react";
import { BillsWidget } from "@/features/bills/components/bills-widget";
import { BudgetsWidget } from "@/features/budgets/components/budgets-widget";
import { CategoryTrendsWidget } from "@/features/category-trends/components/category-trends-widget";
import { CommitmentsWidget } from "@/features/commitments/components/commitments-widget";
import { GoalsWidget } from "@/features/goals/components/goals-widget";
import { InboxWidget } from "@/features/inbox/components/inbox-widget";
import { InstallmentExpensesWidget } from "@/features/installments/components/installment-expenses-widget";
import { InvoicesWidget } from "@/features/invoices/components/invoices-widget";
import { NotesWidget } from "@/features/notes/components/notes-widget";
import { PersonSettlementsWidget } from "@/features/person-settlements/components/person-settlements-widget";
import { RecurringExpensesWidget } from "@/features/recurring-expenses/components/recurring-expenses-widget";
import { CategoryBreakdownWidget } from "./category-breakdown-widget";
import { CategoryTransactionsWidget } from "./category-transactions-widget";
import { DashboardAttentionWidget } from "./dashboard-attention-widget";
import { IncomeExpenseBalanceWidget } from "./income-expense-balance-widget";
import { MyAccountsWidget } from "./my-accounts-widget";
import { PaymentConditionsWidget } from "./payment-conditions-widget";
import { PaymentMethodsWidget } from "./payment-methods-widget";
import { PaymentStatusWidget } from "./payment-status-widget";
import { PeopleWidget } from "./people-widget";

export type DashboardWidgetSectionId = "analysis" | "obligations" | "planning";

/** Groups the grid into titled sections; widgets keep the user's order inside each one. */
export const dashboardWidgetSections: ReadonlyArray<{
  id: DashboardWidgetSectionId;
  title: string;
}> = [
  { id: "obligations", title: "Contas e compromissos" },
  { id: "planning", title: "Planejamento" },
  { id: "analysis", title: "Análises do período" },
];

export type DashboardWidgetDefinition = {
  description: string;
  icon: LucideIcon;
  id: DashboardWidgetId;
  render: (period: string) => ReactNode;
  section: DashboardWidgetSectionId;
  title: string;
  /** Takes two of the three columns on wide screens, for charts that need horizontal room. */
  wide?: boolean;
};

export const dashboardWidgetRegistry: readonly DashboardWidgetDefinition[] = [
  {
    id: "attention",
    section: "obligations",
    title: "Precisa de atenção",
    description: "Faturas, contas, orçamentos e capturas que pedem ação",
    icon: BellRing,
    render: (period) => <DashboardAttentionWidget period={period} variant="band" />,
  },
  {
    id: "accounts",
    section: "obligations",
    title: "Minhas contas",
    description: "Saldos disponíveis e consolidado",
    icon: Landmark,
    render: (period) => <MyAccountsWidget period={period} />,
  },
  {
    id: "invoices",
    section: "obligations",
    title: "Minhas faturas",
    description: "Resumo das faturas do período",
    icon: CreditCard,
    render: (period) => <InvoicesWidget period={period} />,
  },
  {
    id: "bills",
    section: "obligations",
    title: "Contas a pagar",
    description: "Vencimentos e pagamentos do período",
    icon: ReceiptText,
    render: (period) => <BillsWidget period={period} />,
  },
  {
    id: "payment-status",
    section: "obligations",
    title: "Status de pagamento",
    description: "Valores confirmados e pendentes",
    icon: CircleDollarSign,
    render: (period) => <PaymentStatusWidget period={period} />,
  },
  {
    id: "inbox",
    section: "obligations",
    title: "Caixa de entrada",
    description: "Capturas e itens pendentes de revisão",
    icon: FileClock,
    render: () => <InboxWidget />,
  },
  {
    id: "person-settlements",
    section: "obligations",
    title: "Acertos por pessoas",
    description: "Valores a receber e créditos do mês",
    icon: HandCoins,
    render: (period) => <PersonSettlementsWidget period={period} />,
  },
  {
    id: "income-expense-balance",
    section: "analysis",
    title: "Receitas, despesas e resultado",
    description: "Evolução dos últimos seis meses",
    icon: ChartNoAxesCombined,
    render: (period) => <IncomeExpenseBalanceWidget period={period} />,
    wide: true,
  },
  {
    id: "budgets",
    section: "planning",
    title: "Orçamentos",
    description: "Progresso por categoria no período",
    icon: FolderKanban,
    render: (period) => <BudgetsWidget period={period} />,
  },
  {
    id: "goals",
    section: "planning",
    title: "Metas",
    description: "Progresso dos objetivos ativos",
    icon: Goal,
    render: () => <GoalsWidget />,
  },
  {
    id: "commitments",
    section: "planning",
    title: "Comprometimento do mês",
    description: "Quanto da receita do mês já está comprometido",
    icon: Gauge,
    render: (period) => <CommitmentsWidget period={period} />,
  },
  {
    id: "category-trends",
    section: "analysis",
    title: "Tendências de categorias",
    description: "Maiores variações contra o mês anterior",
    icon: Target,
    render: (period) => <CategoryTrendsWidget period={period} />,
  },
  {
    id: "expense-categories",
    section: "analysis",
    title: "Despesas por categoria",
    description: "Distribuição das despesas do período",
    icon: PieChart,
    render: (period) => <CategoryBreakdownWidget period={period} variant="expense" />,
  },
  {
    id: "income-categories",
    section: "analysis",
    title: "Receitas por categoria",
    description: "Distribuição das receitas do período",
    icon: PieChart,
    render: (period) => <CategoryBreakdownWidget period={period} variant="income" />,
  },
  {
    id: "category-transactions",
    section: "analysis",
    title: "Lançamentos por categoria",
    description: "Categorias com maior movimentação",
    icon: Tags,
    render: (period) => <CategoryTransactionsWidget period={period} />,
  },
  {
    id: "people",
    section: "analysis",
    title: "Pessoas",
    description: "Despesas por pessoa no período",
    icon: Users,
    render: (period) => <PeopleWidget period={period} />,
  },
  {
    id: "payment-conditions",
    section: "analysis",
    title: "Condições de pagamento",
    description: "À vista, parceladas e recorrentes",
    icon: Waypoints,
    render: (period) => <PaymentConditionsWidget period={period} />,
  },
  {
    id: "payment-methods",
    section: "analysis",
    title: "Formas de pagamento",
    description: "Distribuição por meio de pagamento",
    icon: WalletCards,
    render: (period) => <PaymentMethodsWidget period={period} />,
  },
  {
    id: "installments",
    section: "obligations",
    title: "Lançamentos parcelados",
    description: "Parcelas abertas e andamento",
    icon: CalendarClock,
    render: (period) => <InstallmentExpensesWidget period={period} />,
  },
  {
    id: "recurring-expenses",
    section: "obligations",
    title: "Lançamentos recorrentes",
    description: "Compromissos recorrentes do período",
    icon: RefreshCcw,
    render: (period) => <RecurringExpensesWidget period={period} />,
  },
  {
    id: "notes",
    section: "planning",
    title: "Anotações",
    description: "Anotações ativas mais recentes",
    icon: BookOpenText,
    render: () => <NotesWidget />,
  },
] as const;

export const dashboardWidgetById = new Map(
  dashboardWidgetRegistry.map((widget) => [widget.id, widget]),
);
