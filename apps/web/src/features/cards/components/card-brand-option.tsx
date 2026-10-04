import type { CardOutput } from "@openmonetis/validators/cards";

import { Image } from "@unpic/react";

import { getCardBrandAsset } from "../card-brand-assets";
import { cardBrandLabels } from "../cards.presentation";

export function CardBrandOption({ brand }: { brand: CardOutput["brand"] }) {
  const asset = getCardBrandAsset(brand);
  return (
    <span className="flex items-center gap-2">
      {asset ? (
        <Image
          alt=""
          className="size-5 rounded-sm object-contain"
          height={20}
          layout="fixed"
          src={asset}
          width={20}
        />
      ) : null}
      <span>{cardBrandLabels[brand]}</span>
    </span>
  );
}
