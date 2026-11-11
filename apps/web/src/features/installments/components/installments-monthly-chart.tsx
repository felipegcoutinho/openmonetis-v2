import type {
  InstallmentPayoffSimulationOutput,
  InstallmentPurchaseSimulationOutput,
  InstallmentsReportOutput,
} from "@openmonetis/validators/installments";
import { MonthlyOutlookChart, type MonthlyOutlookSeries } from "@/components/monthly-outlook-chart";
import {
  payoffSeriesColor,
  purchaseSimulationColor,
  realInstallmentsColor,
} from "../installments.presentation";

type InstallmentsMonthlyChartProps = {
  report: InstallmentsReportOutput;
  isFetching: boolean;
  simulation: InstallmentPurchaseSimulationOutput | null;
  payoff: InstallmentPayoffSimulationOutput | null;
};

/**
 * Real installments plus both simulations, all computed by the API over the same 12 months, so
 * they line up by period. With a payoff, the real bars show what would still be charged.
 */
export function InstallmentsMonthlyChart({
  report,
  isFetching,
  simulation,
  payoff,
}: InstallmentsMonthlyChartProps) {
  const purchaseByPeriod = new Map(
    (simulation?.upcomingMonths ?? []).map((month) => [month.period, month.amount]),
  );
  const payoffByPeriod = new Map(
    (payoff?.upcomingMonths ?? []).map((month) => [month.period, month]),
  );
  const series: MonthlyOutlookSeries[] = [
    {
      key: "installments",
      label: payoff ? "Parcelas mantidas" : "Parcelas",
      color: realInstallmentsColor,
    },
    ...(payoff ? [{ key: "payoff", label: "Quitação simulada", color: payoffSeriesColor }] : []),
    ...(simulation
      ? [
          {
            key: "purchase",
            label: simulation.name ?? "Compra simulada",
            color: purchaseSimulationColor,
          },
        ]
      : []),
    ...(payoff
      ? [
          {
            key: "released",
            label: "Deixa de ser cobrado",
            color: realInstallmentsColor,
            variant: "outline" as const,
          },
        ]
      : []),
  ];

  return (
    <MonthlyOutlookChart
      description="Quanto as parcelas somam em cada mês, a partir de agora."
      emptyMessage="Nenhuma parcela prevista para os próximos 12 meses."
      info="Soma de todas as parcelas do mês, pagas ou pendentes. Parcelas atrasadas de meses anteriores entram no saldo, não no gráfico. Simulações aparecem em outras cores e não alteram nada."
      isFetching={isFetching}
      items={report.upcomingMonths.map((month) => {
        const simulated = payoffByPeriod.get(month.period);
        return {
          period: month.period,
          values: {
            installments: simulated ? simulated.keptAmount : month.totalAmount,
            payoff: simulated?.payoffAmount ?? 0,
            purchase: purchaseByPeriod.get(month.period) ?? 0,
            released: simulated?.releasedAmount ?? 0,
          },
          detail:
            month.activePurchaseCount === 1
              ? "1 compra com parcela"
              : `${month.activePurchaseCount} compras com parcela`,
        };
      })}
      series={series}
      title="Próximos 12 meses"
    />
  );
}
