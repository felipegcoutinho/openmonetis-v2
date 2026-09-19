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
  const label = sourceLabel.replace(/^Fatura\s+/i, "");

  return (
    <span className="inline-flex items-center gap-2">
      {logoUrl ? (
        <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-background">
          <Image alt="" height={28} src={logoUrl} width={28} />
        </span>
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted">
          <CreditCard aria-hidden="true" className="size-4" />
        </span>
      )}
      <span>{label}</span>
    </span>
  );
}
