import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import {
  type FinancialDistributionOutput,
  ListFinancialDistributionQuerySchema,
} from "@openmonetis/validators/financial-distribution";
import { csvCell } from "../../lib/csv";

export function validateFinancialDistributionSearch(search: Record<string, unknown>) {
  const fields = ListFinancialDistributionQuerySchema.shape;
  return {
    period: fields.period.safeParse(search.period).data,
    personScope: fields.personScope.safeParse(search.personScope).data ?? "admin",
    mode: fields.mode.safeParse(search.mode).data ?? "actual",
  };
}

export function resolveFinancialDistributionSearch(
  search: ReturnType<typeof validateFinancialDistributionSearch>,
) {
  return { ...search, period: search.period ?? getCurrentPeriodInBrazil() };
}

type Flow = FinancialDistributionOutput["sources"][number];
export function distributionCategoryLabel(category: { name: string; categoryId: string | null }) {
  return category.categoryId ? category.name : "Sem categoria";
}

export function distributionFlowLabel(flow: Flow) {
  if (flow.grouped) return "Outras categorias";
  if (flow.kind === "surplus") return "Saldo do período";
  if (flow.kind === "deficit") return "Déficit do período";
  const name = distributionCategoryLabel(flow);
  return flow.kind === "refund" ? `Estornos e ajustes · ${name}` : name;
}

export function formatDistributionPercentage(value: number | null) {
  return value === null
    ? "—"
    : `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}%`;
}

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];
export function distributionColor(key: string, kind?: Flow["kind"]) {
  if (kind === "surplus") return "var(--success)";
  if (kind === "deficit") return "var(--destructive)";
  if (kind === "refund") return "var(--info)";
  const hash = Array.from(key).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0,
  );
  return chartColors[hash % chartColors.length];
}

export function formatSignedDistributionPercentage(value: number | null) {
  if (value === null) return "—";
  const formatted = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(
    Math.abs(value),
  );
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}%`;
}

/** Assigns palette colors by rank on each side so neighbouring flows never share a color. */
export function distributionColorMap(
  report: Pick<FinancialDistributionOutput, "sources" | "destinations">,
) {
  const colors = new Map<string, string>();
  for (const flows of [report.sources, report.destinations]) {
    let rank = 0;
    for (const flow of flows) {
      if (flow.grouped) {
        colors.set(flow.key, "var(--muted-foreground)");
        continue;
      }
      if (flow.kind === "income" || flow.kind === "expense") {
        colors.set(flow.key, chartColors[rank % chartColors.length]);
        rank += 1;
      }
    }
  }
  return colors;
}

export function flowColor(colors: ReadonlyMap<string, string>, key: string, kind?: Flow["kind"]) {
  return colors.get(key) ?? distributionColor(key, kind);
}

export function financialDistributionCsv(report: FinancialDistributionOutput) {
  const rows: string[][] = [
    ["Período", "Composição", "Tipo", "Categoria", "Subcategoria", "Valor", "% do tipo"],
  ];
  for (const category of report.categories) {
    const base = [
      report.period,
      report.mode === "actual" ? "Lançados" : "Com previsões",
      category.type === "income" ? "Receita" : "Despesa",
      distributionCategoryLabel(category),
    ];
    rows.push([
      ...base,
      "Total da categoria",
      category.amount.toFixed(2).replace(".", ","),
      category.percentage?.toString().replace(".", ",") ?? "",
    ]);
    if (category.children.length) {
      rows.push([
        ...base,
        "Sem subcategoria",
        category.directAmount.toFixed(2).replace(".", ","),
        "",
      ]);
      for (const child of category.children)
        rows.push([
          ...base,
          child.name,
          child.amount.toFixed(2).replace(".", ","),
          child.percentage?.toString().replace(".", ",") ?? "",
        ]);
    }
  }
  rows.push([
    report.period,
    "",
    "Saldo do período",
    "",
    "",
    report.balanceAmount.toFixed(2).replace(".", ","),
    "",
  ]);
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`;
}

export function downloadFinancialDistributionCsv(report: FinancialDistributionOutput) {
  const url = URL.createObjectURL(
    new Blob([financialDistributionCsv(report)], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `distribuicao-financeira-${report.period}-${report.mode}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

const svgStyleProperties = [
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-opacity",
  "stroke-width",
  "font-family",
  "font-size",
  "font-weight",
  "opacity",
] as const;

/** Rasterizes a rendered chart SVG, inlining computed styles so theme tokens survive. */
export async function downloadSvgAsPng(svg: SVGSVGElement, filename: string) {
  const { width, height } = svg.getBoundingClientRect();
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const sources = [svg, ...svg.querySelectorAll("*")];
  const targets = [clone, ...clone.querySelectorAll("*")];
  sources.forEach((source, index) => {
    const computed = getComputedStyle(source);
    const target = targets[index] as SVGElement | undefined;
    if (!target) return;
    for (const property of svgStyleProperties)
      target.style.setProperty(property, computed.getPropertyValue(property));
  });
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  const markup = new XMLSerializer().serializeToString(clone);
  const imageUrl = URL.createObjectURL(new Blob([markup], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("svg-render-failed"));
      image.src = imageUrl;
    });
    const scale = 2;
    const canvas = document.createElement("canvas");
    canvas.width = width * scale;
    canvas.height = height * scale;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("canvas-unavailable");
    context.fillStyle = getComputedStyle(document.body).backgroundColor || "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("png-encode-failed");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
