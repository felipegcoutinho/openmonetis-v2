import { ChartColumn, Info } from "lucide-react";
import {
  Bar,
  BarChart,
  type BarShapeProps,
  CartesianGrid,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts";
import { ChartLegendMarker } from "@/components/chart-legend-marker";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { type ChartConfig, ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatPeriod } from "@/lib/period-presentation";
import { cn } from "@/lib/utils";

export type MonthlyOutlookSeries = {
  key: string;
  label: string;
  /** Any CSS color, usually a chart token such as `var(--brand)`. */
  color: string;
  /** `outline` draws a dashed, unfilled segment, e.g. amounts a simulation would remove. */
  variant?: "solid" | "outline";
};

export type MonthlyOutlookItem = {
  period: string;
  /** Amount per series key; missing keys count as zero. */
  values: Record<string, number>;
  /** Secondary line shown in the tooltip and the accessible table, e.g. "3 compras". */
  detail?: string;
};

type MonthlyOutlookChartProps = {
  title: string;
  description: string;
  /** Explains what the bars include; shown behind an info button next to the title. */
  info: string;
  /** Stacked bottom to top. The first one is the real series and gets the current-month legend. */
  series: MonthlyOutlookSeries[];
  items: MonthlyOutlookItem[];
  emptyMessage: string;
  isFetching?: boolean;
};

const axisNumberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const CURRENT_MONTH_LABEL = "Este mês";
const UPCOMING_MONTH_OPACITY = 0.45;
const TOP_RADIUS: [number, number, number, number] = [4, 4, 0, 0];

function formatAxisAmount(value: number) {
  return value >= 1000
    ? `R$ ${axisNumberFormatter.format(value / 1000)} mil`
    : `R$ ${axisNumberFormatter.format(value)}`;
}

function translucent(color: string) {
  return `color-mix(in oklab, ${color} ${UPCOMING_MONTH_OPACITY * 100}%, transparent)`;
}

/** Twelve-month stacked bar chart that starts at the current month, drawn solid and labeled. */
export function MonthlyOutlookChart({
  title,
  description,
  info,
  series,
  items,
  emptyMessage,
  isFetching = false,
}: MonthlyOutlookChartProps) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const [primary, ...extras] = series;
  const currentPeriod = items[0]?.period;
  const amountOf = (item: MonthlyOutlookItem, key: string) => item.values[key] ?? 0;
  const hasData = items.some((item) => series.some(({ key }) => amountOf(item, key) > 0));
  const hasDetails = items.some((item) => item.detail);
  const data = items.map((item) => ({ ...item, ...item.values }));
  const chartConfig = Object.fromEntries(
    series.map(({ key, label, color }) => [key, { label, color }]),
  ) satisfies ChartConfig;

  /** Height of the drawn stack, i.e. what the bar shows; dashed outlines are not charged. */
  function stackHeight(item: MonthlyOutlookItem) {
    const cents = series
      .filter(({ variant }) => variant !== "outline")
      .reduce((sum, { key }) => sum + Math.round(amountOf(item, key) * 100), 0);
    return cents / 100;
  }

  function isTopSegment(item: MonthlyOutlookItem, index: number) {
    return series.slice(index + 1).every(({ key }) => amountOf(item, key) <= 0);
  }

  return (
    <Card className="gap-0 py-0 shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 p-5 pb-2 sm:p-6 sm:pb-2">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-muted">
          <ChartColumn aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="section-title">{title}</h2>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-label="Como ler o gráfico"
                    className="relative shrink-0 rounded-full text-muted-foreground after:absolute after:-inset-3 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    type="button"
                  />
                }
              >
                <Info aria-hidden="true" className="size-4" />
              </TooltipTrigger>
              <TooltipContent className="max-w-72 text-pretty">{info}</TooltipContent>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-pretty text-muted-foreground text-xs sm:text-sm">
            {description}
          </p>
        </div>
      </CardHeader>
      <CardContent aria-busy={isFetching} className="px-3 pb-5 sm:px-6 sm:pb-6">
        {hasData && primary ? (
          <>
            <ChartContainer
              aria-hidden="true"
              className={cn(
                "h-60 w-full transition-[filter] sm:h-72",
                isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
              )}
              config={chartConfig}
            >
              <BarChart accessibilityLayer data={data} margin={{ left: 0, right: 0, top: 14 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  axisLine={false}
                  dataKey="period"
                  minTickGap={18}
                  tickFormatter={(value) =>
                    value === currentPeriod
                      ? CURRENT_MONTH_LABEL
                      : formatPeriod(String(value), true)
                  }
                  tickLine={false}
                  tickMargin={8}
                />
                <YAxis
                  axisLine={false}
                  tickFormatter={(value) => formatAxisAmount(Number(value))}
                  tickLine={false}
                  width={80}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    const item = payload?.[0]?.payload as MonthlyOutlookItem | undefined;
                    if (!active || !item) return null;
                    const visible = series.filter(
                      ({ key }, index) => index === 0 || amountOf(item, key) > 0,
                    );
                    const stacked = visible.filter(({ variant }) => variant !== "outline");
                    return (
                      <div className="grid min-w-48 gap-1 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
                        <p className="font-medium">
                          {formatPeriod(item.period)}
                          {item.period === currentPeriod ? ` · ${CURRENT_MONTH_LABEL}` : ""}
                        </p>
                        {visible.map(({ key, label, color, variant }) => (
                          <p className="flex items-center gap-1.5" key={key}>
                            <ChartLegendMarker
                              color={color}
                              variant={variant === "outline" ? "line" : "area"}
                            />
                            <span className="text-muted-foreground">{label}</span>
                            <MoneyValue
                              amount={amountOf(item, key)}
                              className={cn(
                                "ml-auto font-medium",
                                variant === "outline" && "line-through",
                              )}
                            />
                          </p>
                        ))}
                        {stacked.length > 1 ? (
                          <p className="flex items-center gap-1.5 border-t pt-1 font-medium">
                            Total do mês
                            <MoneyValue amount={stackHeight(item)} className="ml-auto" />
                          </p>
                        ) : null}
                        {item.detail ? (
                          <p className="text-muted-foreground">{item.detail}</p>
                        ) : null}
                      </div>
                    );
                  }}
                  cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                />
                {series.map(({ key, color, variant }, index) => (
                  <Bar
                    dataKey={key}
                    fill={color}
                    key={key}
                    maxBarSize={46}
                    shape={(props: BarShapeProps) => {
                      const item = props.payload as MonthlyOutlookItem;
                      const radius = isTopSegment(item, index) ? TOP_RADIUS : 0;
                      return variant === "outline" ? (
                        <Rectangle
                          {...props}
                          fill="transparent"
                          radius={radius}
                          stroke={color}
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Rectangle
                          {...props}
                          fillOpacity={item.period === currentPeriod ? 1 : UPCOMING_MONTH_OPACITY}
                          radius={radius}
                        />
                      );
                    }}
                    stackId="outlook"
                  />
                ))}
              </BarChart>
            </ChartContainer>
            <div
              aria-hidden="true"
              className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-muted-foreground text-xs"
            >
              <span className="flex items-center gap-1.5">
                <ChartLegendMarker color={primary.color} />
                {CURRENT_MONTH_LABEL}
              </span>
              <span className="flex items-center gap-1.5">
                <ChartLegendMarker color={translucent(primary.color)} />
                Próximos meses
              </span>
              {extras.map(({ key, label, color, variant }) => (
                <span className="flex items-center gap-1.5" key={key}>
                  {variant === "outline" ? (
                    <span
                      className="size-3 shrink-0 rounded-[3px] border-[1.5px] border-dashed"
                      style={{ borderColor: color }}
                    />
                  ) : (
                    <ChartLegendMarker color={translucent(color)} />
                  )}
                  {label}
                </span>
              ))}
            </div>
            {isPrivacyModeEnabled ? (
              <span className="sr-only">Gráfico oculto pelo modo privacidade.</span>
            ) : (
              // Tables ignore `width: 1px`, so the visually hidden wrapper clips them instead.
              <div className="sr-only">
                <table aria-label={title}>
                  <thead>
                    <tr>
                      <th scope="col">Mês</th>
                      {series.map(({ key, label }) => (
                        <th key={key} scope="col">
                          {label}
                        </th>
                      ))}
                      {hasDetails ? <th scope="col">Detalhe</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.period}>
                        <th scope="row">{formatPeriod(item.period)}</th>
                        {series.map(({ key }) => (
                          <td key={key}>
                            <MoneyValue amount={amountOf(item, key)} />
                          </td>
                        ))}
                        {hasDetails ? <td>{item.detail ?? ""}</td> : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <div className="grid h-48 place-items-center text-center text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
