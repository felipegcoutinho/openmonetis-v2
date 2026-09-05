import type { CardBrand } from "@openmonetis/domain/cards";
import { Image } from "@unpic/react";
import { CreditCard } from "lucide-react";
import { getCardBrandAsset } from "@/features/cards/card-brand-assets";

export function ExternalExpenseSource({
  sourceCardBrand,
  sourceLabel,
  sourceLogoUrl,
}: {
  sourceCardBrand: CardBrand | null;
  sourceLabel: string | null;
  sourceLogoUrl: string | null;
}) {
  if (!sourceLabel) return null;
  const logoUrl = sourceLogoUrl ?? (sourceCardBrand ? getCardBrandAsset(sourceCardBrand) : null);

  return (
    <span className="inline-flex items-center gap-1.5">
      {logoUrl ? (
        <span className="grid size-4 shrink-0 place-items-center overflow-hidden rounded-sm bg-background">
          <Image alt="" height={16} src={logoUrl} width={16} />
        </span>
      ) : (
        <CreditCard aria-hidden="true" className="size-3.5 shrink-0" />
      )}
      <span>{sourceLabel}</span>
    </span>
  );
}
