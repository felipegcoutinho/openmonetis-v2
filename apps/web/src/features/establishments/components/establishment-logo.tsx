import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";
import { establishmentLogoQueryOptions } from "../establishments.queries";
import { EstablishmentLogoPicker } from "./establishment-logo-picker";

type EstablishmentLogoProps = {
  name: string;
  categoryIcon: string | null;
  size?: number;
  className?: string;
  editable?: boolean;
  fallbackLogoUrl?: string | null;
};

export function EstablishmentLogo({
  name,
  categoryIcon,
  size = 32,
  className,
  editable = true,
  fallbackLogoUrl = null,
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
      className="grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
      style={{ width: size, height: size }}
    >
      <CategoryIcon
        className={size <= 20 ? "size-2.5" : size < 32 ? "size-3.5" : "size-4"}
        name={categoryIcon}
      />
    </span>
  );
  if (!editable || !data?.enabled)
    return <span className={cn("inline-flex shrink-0", className)}>{avatar}</span>;
  return (
    <EstablishmentLogoPicker categoryIcon={categoryIcon} name={name} selectedDomain={data.domain}>
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
