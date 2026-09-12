export const categoryTypes = ["income", "expense"] as const;
export type CategoryType = (typeof categoryTypes)[number];
export const internalTransferCategoryName = "Transferência interna";
export const invoicePaymentCategoryName = "Pagamentos";
export const balanceAdjustmentCategoryName = "Ajuste de saldo";
export const invoiceAdjustmentCategoryName = "Ajustes de fatura";
export const yieldCategoryName = "Rendimentos";
export const personSettlementCategoryName = "Repasses";
export const otherExpenseCategoryName = "Outras despesas";
export const otherIncomeCategoryName = "Outras receitas";

export type CategoryCreateDraft = {
  userId: string;
  name: string;
  type: CategoryType;
  icon: string | null;
  isSystem: boolean;
};

export function createCategoryDraft(
  input: Omit<CategoryCreateDraft, "isSystem">,
): CategoryCreateDraft {
  return {
    ...input,
    name: input.name.trim(),
    icon: input.icon?.trim() || null,
    isSystem: false,
  };
}

export function canChangeCategoryType(input: {
  currentType: CategoryType;
  nextType: CategoryType;
  hasFinancialReferences: boolean;
}) {
  return input.currentType === input.nextType || !input.hasFinancialReferences;
}

const defaultCategoryDefinitions: Array<{
  name: string;
  type: CategoryType;
  icon: string;
  isSystem?: boolean;
}> = [
  {
    name: balanceAdjustmentCategoryName,
    type: "expense",
    icon: "circle-dollar-sign",
    isSystem: true,
  },
  { name: "Alimentação", type: "expense", icon: "utensils" },
  { name: "Transporte", type: "expense", icon: "bus" },
  { name: "Moradia", type: "expense", icon: "home" },
  { name: "Saúde", type: "expense", icon: "heart-pulse" },
  { name: "Educação", type: "expense", icon: "book-open" },
  { name: "Lazer", type: "expense", icon: "gamepad" },
  { name: "Compras", type: "expense", icon: "shopping-bag" },
  { name: "Assinaturas", type: "expense", icon: "repeat" },
  { name: "Pets", type: "expense", icon: "paw-print" },
  { name: "Mercado", type: "expense", icon: "shopping-basket" },
  { name: "Restaurantes", type: "expense", icon: "restaurant" },
  { name: "Delivery", type: "expense", icon: "bike" },
  { name: "Energia e água", type: "expense", icon: "zap" },
  { name: "Internet", type: "expense", icon: "wifi" },
  { name: "Vestuário", type: "expense", icon: "shirt" },
  { name: "Viagem", type: "expense", icon: "plane" },
  { name: "Presentes", type: "expense", icon: "gift" },
  { name: invoicePaymentCategoryName, type: "expense", icon: "receipt", isSystem: true },
  {
    name: invoiceAdjustmentCategoryName,
    type: "expense",
    icon: "receipt-text",
    isSystem: true,
  },
  { name: otherExpenseCategoryName, type: "expense", icon: "more-horizontal" },
  { name: "Salário", type: "income", icon: "wallet" },
  { name: "Freelance", type: "income", icon: "briefcase" },
  { name: yieldCategoryName, type: "income", icon: "trending-up" },
  { name: personSettlementCategoryName, type: "income", icon: "hand-coins", isSystem: true },
  { name: "Investimentos", type: "income", icon: "chart" },
  { name: "Vendas", type: "income", icon: "store" },
  { name: "Prêmios", type: "income", icon: "medal" },
  { name: "Reembolso", type: "income", icon: "refresh-cw" },
  { name: "Aluguel recebido", type: "income", icon: "building" },
  { name: otherIncomeCategoryName, type: "income", icon: "more-horizontal" },
  {
    name: balanceAdjustmentCategoryName,
    type: "income",
    icon: "circle-dollar-sign",
    isSystem: true,
  },
  {
    name: internalTransferCategoryName,
    type: "income",
    icon: "arrow-left-right",
    isSystem: true,
  },
];

export function createDefaultCategoryDrafts(userId: string): CategoryCreateDraft[] {
  return defaultCategoryDefinitions.map((category) => ({
    ...category,
    userId,
    isSystem: category.isSystem ?? false,
  }));
}
