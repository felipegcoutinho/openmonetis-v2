import type { CardOutput } from "@openmonetis/validators/cards";

const cardBrandAssets: Partial<Record<CardOutput["brand"], string>> = {
  visa: "/flags/visa.svg",
  mastercard: "/flags/mastercard.svg",
  amex: "/flags/amex.svg",
  elo: "/flags/elo.svg",
  hipercard: "/flags/hipercard.svg",
};

export function getCardBrandAsset(brand: CardOutput["brand"]) {
  return cardBrandAssets[brand] ?? null;
}
