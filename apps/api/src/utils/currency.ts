/** Amounts written into generated notes, which are shown to the person in PT-BR. */
export function formatCurrency(amount: number) {
  return amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
