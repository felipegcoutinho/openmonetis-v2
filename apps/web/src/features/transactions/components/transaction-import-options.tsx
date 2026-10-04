import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";

import { Image } from "@unpic/react";

import type { ReactNode } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { CategoryIcon } from "@/features/categories/category-icons";
import { cn } from "@/lib/utils";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-1.5 border-0 p-0">
      <legend className="mb-1.5 font-medium text-sm">{label}</legend>
      {children}
    </fieldset>
  );
}

export function EntityOption({
  entity,
  kind,
}: {
  entity: Pick<AccountOutput, "name" | "logo"> | Pick<CardOutput, "name" | "logo">;
  kind: "Conta" | "Cartão";
}) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      {entity.logo ? (
        <Image
          alt=""
          className="size-8 shrink-0 rounded-full object-contain"
          height={32}
          layout="fixed"
          src={entity.logo}
          width={32}
        />
      ) : (
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-medium text-[10px] text-muted-foreground">
          {entity.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
        </span>
      )}
      <span className="grid min-w-0 text-left">
        <span className="truncate font-medium text-sm">{entity.name}</span>
        <span className="text-muted-foreground text-xs">{kind}</span>
      </span>
    </span>
  );
}

export function PersonOption({
  compact = false,
  description,
  person,
}: {
  compact?: boolean;
  description?: string;
  person?: PersonOutput;
}) {
  if (!person) return <span>Pessoas diferentes</span>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar size="sm" className={cn(!compact && "size-8")}>
        <AvatarImage alt="" src={person.avatarUrl ?? undefined} />
        <AvatarFallback>{person.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 text-left">
        <span className="truncate font-medium text-sm">{person.name}</span>
        {!compact ? (
          <span className="truncate text-muted-foreground text-xs">
            {description ??
              (person.role === "admin" ? "Administradora" : (person.email ?? "Pessoa"))}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function CategoryOption({
  category,
  compact = false,
  description,
}: {
  category?: CategoryOutput;
  compact?: boolean;
  description?: string;
}) {
  if (!category) return <span>Categorias diferentes</span>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-full bg-muted text-muted-foreground",
          compact ? "size-6" : "size-8",
        )}
      >
        <CategoryIcon className={compact ? "size-3.5" : "size-4"} name={category.icon} />
      </span>
      <span className="grid min-w-0 text-left">
        <span className="truncate font-medium text-sm">{category.name}</span>
        {!compact && description ? (
          <span className="text-muted-foreground text-xs">{description}</span>
        ) : null}
      </span>
    </span>
  );
}

export function TextOption({ description, label }: { description?: string; label: string }) {
  return (
    <span className="grid min-w-0 text-left">
      <span className="truncate font-medium text-sm">{label}</span>
      {description ? <span className="text-muted-foreground text-xs">{description}</span> : null}
    </span>
  );
}
