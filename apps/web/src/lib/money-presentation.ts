export function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function parseCurrencyInput(value: string) {
  const compactValue = value.replace(/[^\d,.-]/g, "");
  const normalized = compactValue.includes(",")
    ? compactValue.replace(/\./g, "").replace(",", ".")
    : compactValue;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

const chartAxisNumberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

/** Short currency label for chart axes, such as "R$ 1,5 mil". */
export function formatChartAxisAmount(value: number) {
  return value >= 1000
    ? `R$ ${chartAxisNumberFormatter.format(value / 1000)} mil`
    : `R$ ${chartAxisNumberFormatter.format(value)}`;
}
