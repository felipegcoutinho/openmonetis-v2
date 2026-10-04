import { Image } from "@unpic/react";
import { CreditCard, Landmark } from "lucide-react";

export function FinancialRelation({
  kind,
  logo,
  name,
}: {
  kind: "account" | "card";
  logo: string | null;
  name: string | null;
}) {
  if (!name) return <span>Não se aplica</span>;
  const FallbackIcon = kind === "card" ? CreditCard : Landmark;

  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      {logo ? (
        <Image
          alt={`Logo de ${name}`}
          className="size-7 shrink-0 rounded-full object-contain"
          height={28}
          layout="fixed"
          src={logo}
          width={28}
        />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
          <FallbackIcon aria-hidden="true" className="size-3.5" />
        </span>
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
