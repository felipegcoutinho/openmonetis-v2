import type { FinancialDistributionOutput } from "@openmonetis/validators/financial-distribution";
import { Link } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useRef, useState } from "react";
import { Sankey } from "recharts";
import { MoneyValue } from "@/components/money-value";
import { usePrivacyMode } from "@/components/privacy-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useExportFinancialDistributionImageMutation } from "../financial-distribution.mutations";
import {
  distributionColorMap,
  distributionFlowLabel,
  flowColor,
  formatDistributionMoney,
  formatDistributionPercentage,
} from "../financial-distribution.presentation";
import { FinancialDistributionPercentage } from "./financial-distribution-percentage";

type Props = { report: FinancialDistributionOutput; personScope: string };
type Flow = FinancialDistributionOutput["sources"][number];

function FlowSummary({
  title,
  flows,
  indicatorClassName,
}: {
  title: string;
  flows: Flow[];
  indicatorClassName: string;
}) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  return (
    <div className="grid gap-3">
      <h3 className="font-medium text-muted-foreground text-xs">{title}</h3>
      <ul className="grid gap-3">
        {flows.map((flow) => (
          <li key={flow.key} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate text-sm">{distributionFlowLabel(flow)}</span>
              <MoneyValue amount={flow.amount} className="shrink-0 text-sm" />
            </div>
            <div className="flex items-center gap-3">
              {isPrivacyModeEnabled ? (
                <span aria-hidden="true" className="block h-1 flex-1" />
              ) : (
                <Progress
                  aria-hidden="true"
                  className="flex-1"
                  indicatorClassName={indicatorClassName}
                  trackClassName="h-1"
                  value={Math.min(100, Math.max(0, flow.percentage ?? 0))}
                />
              )}
              <FinancialDistributionPercentage value={flow.percentage} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FinancialDistributionChart({ report, personScope }: Props) {
  const { isPrivacyModeEnabled } = usePrivacyMode();
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const sankeyRef = useRef<HTMLDivElement>(null);
  const exportImage = useExportFinancialDistributionImageMutation();
  const colors = distributionColorMap(report);
  const centerIndex = report.sources.length;
  const nodes = [
    ...report.sources.map((flow) => ({
      ...flow,
      label: distributionFlowLabel(flow),
      side: "source" as const,
    })),
    {
      key: "total",
      categoryId: null,
      name: "",
      label: "Total distribuído",
      amount: report.flowAmount,
      percentage: 100,
      kind: "total" as const,
      side: "center" as const,
    },
    ...report.destinations.map((flow) => ({
      ...flow,
      label: distributionFlowLabel(flow),
      side: "destination" as const,
    })),
  ];
  const links = [
    ...report.sources.map((flow, index) => ({
      source: index,
      target: centerIndex,
      value: flow.amount,
    })),
    ...report.destinations.map((flow, index) => ({
      source: centerIndex,
      target: centerIndex + index + 1,
      value: flow.amount,
    })),
  ];
  const height = Math.max(
    360,
    Math.max(report.sources.length, report.destinations.length) * 64 + 80,
  );
  return (
    <Card className="min-w-0 gap-0 overflow-hidden pt-0">
      <CardHeader className="border-b py-5">
        <CardTitle>
          <h2>O caminho do seu dinheiro</h2>
        </CardTitle>
        <CardDescription>Das categorias de receita às categorias de despesa.</CardDescription>
      </CardHeader>
      <CardContent className="px-0 pt-5 sm:px-6">
        <div className="grid gap-6 px-5 sm:px-0 xl:hidden">
          <FlowSummary
            title="De onde vem"
            flows={report.sources}
            indicatorClassName="bg-success/70"
          />
          <FlowSummary
            title="Para onde vai"
            flows={report.destinations}
            indicatorClassName="bg-destructive/70"
          />
        </div>
        <div className="mb-3 hidden justify-end px-6 sm:px-0 xl:flex">
          <Button
            disabled={isPrivacyModeEnabled || exportImage.isPending}
            size="sm"
            type="button"
            variant="outline"
            onClick={() => {
              const svg = sankeyRef.current?.querySelector("svg.recharts-surface");
              if (svg instanceof SVGSVGElement)
                exportImage.mutate({
                  svg,
                  filename: `distribuicao-financeira-${report.period}-${report.mode}.png`,
                });
            }}
          >
            <Download aria-hidden="true" />
            {exportImage.isPending ? "Gerando..." : "Baixar imagem"}
          </Button>
        </div>
        <section
          ref={sankeyRef}
          aria-label="Gráfico de distribuição financeira"
          className="hidden overflow-x-auto xl:block"
        >
          <div
            aria-hidden={isPrivacyModeEnabled}
            inert={isPrivacyModeEnabled}
            className={cn(
              "min-w-280",
              isPrivacyModeEnabled && "pointer-events-none blur-sm select-none",
            )}
          >
            <ChartContainer config={{}} className="w-full aspect-auto" style={{ height }}>
              <Sankey
                accessibilityLayer
                data={{ nodes, links }}
                margin={{ left: 220, right: 295, top: 60, bottom: 30 }}
                nodePadding={34}
                nodeWidth={12}
                iterations={0}
                sort={false}
                node={({ x, y, width, height: nodeHeight, index }) => {
                  const node = nodes[index];
                  if (!node) return <g />;
                  const color =
                    node.kind === "total"
                      ? "var(--foreground)"
                      : flowColor(colors, node.key, node.kind);
                  const labelX = node.side === "source" ? x - 14 : x + width + 14;
                  const labelY = y + nodeHeight / 2;
                  const anchor = node.side === "source" ? "end" : "start";
                  const text =
                    node.side === "center" ? (
                      <text
                        x={x + width / 2}
                        y={y - 32}
                        textAnchor="middle"
                        className="fill-foreground text-xs"
                      >
                        <tspan x={x + width / 2}>{node.label}</tspan>
                        <tspan x={x + width / 2} dy={20} className="tabular-nums">
                          {formatDistributionMoney(node.amount)}
                        </tspan>
                      </text>
                    ) : (
                      <text
                        x={labelX}
                        y={labelY - 7}
                        textAnchor={anchor}
                        className="fill-foreground text-xs"
                      >
                        <tspan x={labelX}>
                          {node.label.length > 32 ? `${node.label.slice(0, 31)}…` : node.label}
                        </tspan>
                        <tspan x={labelX} dy={20} className="tabular-nums">
                          {formatDistributionMoney(node.amount)} ·{" "}
                          {formatDistributionPercentage(node.percentage)}
                        </tspan>
                      </text>
                    );
                  const dimmed =
                    hoveredKey !== null && node.kind !== "total" && node.key !== hoveredKey;
                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: hover decorativo; os valores estão disponíveis nas listas e no título do nó
                    <g
                      opacity={dimmed ? 0.35 : 1}
                      onMouseEnter={() => node.kind !== "total" && setHoveredKey(node.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                    >
                      <title>{`${node.label}: ${formatDistributionMoney(node.amount)} · ${formatDistributionPercentage(node.percentage)}`}</title>
                      <rect x={x} y={y} width={width} height={nodeHeight} rx={3} fill={color} />
                      {node.categoryId ? (
                        <Link
                          to="/categories/$categoryId"
                          params={{ categoryId: node.categoryId }}
                          search={{ period: report.period, personScope }}
                          aria-label={`${node.label}: ${formatDistributionMoney(node.amount)}`}
                          className="outline-none hover:underline focus-visible:underline"
                        >
                          {text}
                        </Link>
                      ) : (
                        text
                      )}
                    </g>
                  );
                }}
                link={({
                  sourceX,
                  sourceY,
                  sourceControlX,
                  targetX,
                  targetY,
                  targetControlX,
                  linkWidth,
                  index,
                }) => {
                  const link = links[index];
                  const target = link ? nodes[link.target] : undefined;
                  const source = link ? nodes[link.source] : undefined;
                  const flow = target?.side === "center" ? source : target;
                  const color =
                    !flow || flow.kind === "total"
                      ? "var(--muted-foreground)"
                      : flowColor(colors, flow.key, flow.kind);
                  const active = hoveredKey !== null && flow?.key === hoveredKey;
                  return (
                    // biome-ignore lint/a11y/noStaticElementInteractions: hover decorativo do gráfico
                    <path
                      onMouseEnter={() => flow && setHoveredKey(flow.key)}
                      onMouseLeave={() => setHoveredKey(null)}
                      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
                      fill="none"
                      stroke={color}
                      strokeOpacity={active ? 0.55 : hoveredKey !== null ? 0.1 : 0.25}
                      strokeWidth={linkWidth}
                    />
                  );
                }}
              />
            </ChartContainer>
          </div>
        </section>
        {isPrivacyModeEnabled ? (
          <p className="px-5 text-muted-foreground text-xs xl:px-0" role="status">
            Gráfico oculto pelo modo privacidade.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="grid gap-1.5 border-t pt-4 text-muted-foreground text-xs leading-relaxed">
        <p>Faixas mais largas indicam valores maiores. Os percentuais usam o total distribuído.</p>
        {report.balanceAmount < 0 ? (
          <p>Déficit é o valor das despesas que excede as receitas do período.</p>
        ) : null}
        {report.sources.some((flow) => flow.kind === "refund") ? (
          <p>Estornos e ajustes aparecem na origem quando superam os gastos da categoria.</p>
        ) : null}
      </CardFooter>
    </Card>
  );
}
