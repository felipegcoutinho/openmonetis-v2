import { type LucideIcon, X } from "lucide-react";
import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function FilterChip({
  label,
  onRemove,
  icon: Icon,
  imageSrc,
  visual,
}: {
  label: string;
  onRemove: () => void;
  icon?: LucideIcon;
  imageSrc?: string | null;
  visual?: ReactNode;
}) {
  const separatorIndex = label.indexOf(": ");
  const filterName = separatorIndex >= 0 ? label.slice(0, separatorIndex) : null;
  const filterValue = separatorIndex >= 0 ? label.slice(separatorIndex + 2) : label;

  return (
    <span className="inline-flex min-h-10 max-w-full shrink-0 items-center gap-2 rounded-lg border border-border/60 bg-background py-1 pl-2.5 pr-1">
      {imageSrc !== undefined ? (
        <Avatar className="size-5 shrink-0" size="sm" aria-hidden="true">
          <AvatarImage alt="" src={imageSrc ?? undefined} />
          <AvatarFallback>{Icon ? <Icon className="size-3.5" /> : null}</AvatarFallback>
        </Avatar>
      ) : visual ? (
        <span aria-hidden="true" className="flex shrink-0 items-center text-muted-foreground">
          {visual}
        </span>
      ) : Icon ? (
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      ) : null}
      <span className="min-w-0 text-left leading-tight">
        {filterName ? (
          <span className="block text-[10px] text-muted-foreground">{filterName}</span>
        ) : null}
        <span className="block truncate text-xs font-medium" title={filterValue}>
          {filterValue}
        </span>
      </span>
      <Button
        aria-label={`Remover filtro ${label}`}
        className="ml-1 shrink-0 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={onRemove}
        size="icon-sm"
        title={`Remover filtro ${label}`}
        type="button"
        variant="ghost"
      >
        <X aria-hidden="true" className="size-3.5" />
      </Button>
    </span>
  );
}
