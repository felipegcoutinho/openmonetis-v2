import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { Pencil } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { getEstablishmentInitials } from "../establishments.presentation";
import { establishmentLogoQueryOptions } from "../establishments.queries";
import { EstablishmentLogoPicker } from "./establishment-logo-picker";

type EstablishmentLogoProps = {
  name: string;
  size?: number;
  className?: string;
  editable?: boolean;
  fallbackLogoUrl?: string | null;
  fallback?: ReactNode;
};

export function EstablishmentLogo({
  name,
  size = 32,
  className,
  editable = true,
  fallbackLogoUrl = null,
  fallback,
}: EstablishmentLogoProps) {
  const { data } = useQuery(establishmentLogoQueryOptions(name));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const preferredLogoUrl = data?.logoUrl ?? fallbackLogoUrl;
  const logoUrl = preferredLogoUrl && preferredLogoUrl !== failedUrl ? preferredLogoUrl : null;
  const avatar = logoUrl ? (
    <Image
      alt={`Logo de ${name}`}
      className="rounded-full object-contain"
      height={size}
      onError={() => setFailedUrl(logoUrl)}
      src={logoUrl}
      width={size}
    />
  ) : (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        fallback ? "bg-muted text-muted-foreground" : "bg-brand/10 text-brand-strong",
      )}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.34)) }}
    >
      {fallback ?? getEstablishmentInitials(name)}
    </span>
  );
  if (!editable || !data?.enabled)
    return <span className={cn("inline-flex shrink-0", className)}>{avatar}</span>;
  return (
    <EstablishmentLogoPicker name={name} selectedDomain={data.domain}>
      <button
        aria-label={`Alterar logo de ${name}`}
        className={cn(
          "group relative inline-flex shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
        onClick={(event) => event.stopPropagation()}
        type="button"
      >
        {avatar}
        <span
          aria-hidden
          className="absolute inset-0 grid place-items-center rounded-full bg-foreground/65 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          <Pencil className="size-3 text-background" />
        </span>
      </button>
    </EstablishmentLogoPicker>
  );
}
