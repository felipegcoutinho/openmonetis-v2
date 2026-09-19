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
