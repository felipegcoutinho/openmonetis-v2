import type { AiDiagnosisActionKind } from "@openmonetis/domain/ai-diagnoses";
import type { AiDiagnosisResultOutput } from "@openmonetis/validators/ai-diagnoses";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  CalendarClock,
  CreditCard,
  type LucideIcon,
  PiggyBank,
  Repeat,
  Shapes,
  Target,
  Wallet,
} from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Action = AiDiagnosisResultOutput["actions"][number];

const actionVisuals: Record<AiDiagnosisActionKind, { icon: LucideIcon; destination: string }> = {
  reviewCategoryTransactions: { icon: Shapes, destination: "Categoria" },
  createCategoryBudget: { icon: PiggyBank, destination: "Orçamentos" },
  reviewBudgets: { icon: Wallet, destination: "Orçamentos" },
  reviewInvoices: { icon: CreditCard, destination: "Cartões" },
  reviewBills: { icon: CalendarClock, destination: "Contas a pagar" },
  reviewRecurringTransactions: { icon: Repeat, destination: "Recorrentes" },
  createGoal: { icon: Target, destination: "Metas" },
};

const linkClassName =
  "group flex items-start gap-4 rounded-lg p-3 text-left outline-none transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-4";

export function AiDiagnosisActions({
  actions,
  period,
}: {
  actions: AiDiagnosisResultOutput["actions"];
  period: string;
}) {
  if (!actions.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Target aria-hidden="true" className="size-4 shrink-0" />
          Próximos passos
        </CardTitle>
        <CardDescription>
          Sugestões da IA, em ordem de impacto. Cada uma abre a tela certa; nada muda sem você.
        </CardDescription>
        <CardAction>
          <Badge className="font-mono" variant="outline">
            {actions.length} {actions.length === 1 ? "sugestão" : "sugestões"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-1 divide-y divide-border/60">
          {actions.map((action, index) => {
            const visual = actionVisuals[action.kind];
            const Icon = visual.icon;
            return (
              <li className="pt-1 first:pt-0" key={`${action.kind}:${action.categoryId ?? ""}`}>
                <ActionLink action={action} period={period}>
                  <span
                    aria-hidden="true"
                    className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-strong"
                  >
                    <Icon className="size-4.5" />
                    <span className="absolute -top-1.5 -left-1.5 grid size-5 place-items-center rounded-full border border-border bg-background font-mono text-2xs text-foreground tabular-nums">
                      {index + 1}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="eyebrow block text-muted-foreground">
                      {visual.destination}
                    </span>
                    <span className="mt-0.5 block font-medium text-sm">{action.label}</span>
                    <span className="mt-1 block text-muted-foreground text-sm leading-relaxed">
                      {action.reason}
                    </span>
                  </span>
                  <span className="mt-2.5 hidden shrink-0 items-center gap-1 font-medium text-brand-strong text-xs sm:flex">
                    Abrir
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-2.5 size-4 shrink-0 text-muted-foreground sm:hidden"
                  />
                </ActionLink>
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function ActionLink({
  action,
  children,
  period,
}: {
  action: Action;
  children: ReactNode;
  period: string;
}) {
  switch (action.kind) {
    case "reviewCategoryTransactions":
      return action.categoryId ? (
        <Link
          className={linkClassName}
          params={{ categoryId: action.categoryId }}
          search={{ period }}
          to="/categories/$categoryId"
        >
          {children}
        </Link>
      ) : null;
    case "createCategoryBudget":
    case "reviewBudgets":
      return (
        <Link className={linkClassName} search={{ period }} to="/budgets">
          {children}
        </Link>
      );
    case "reviewInvoices":
      return (
        <Link className={linkClassName} to="/cards">
          {children}
        </Link>
      );
    case "reviewBills":
      return (
        <Link
          className={linkClassName}
          search={{ payables: true, period, settlement: "unpaid", sort: "dueDate" }}
          to="/transactions"
        >
          {children}
        </Link>
      );
    case "reviewRecurringTransactions":
      return (
        <Link
          className={linkClassName}
          search={{ type: "expense", status: "active", paymentMethod: "all", q: "" }}
          to="/reports/recurring-transactions"
        >
          {children}
        </Link>
      );
    case "createGoal":
      return (
        <Link className={linkClassName} to="/goals">
          {children}
        </Link>
      );
  }
}
