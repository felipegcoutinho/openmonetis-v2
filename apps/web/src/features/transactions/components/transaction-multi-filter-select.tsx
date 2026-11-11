import { Image } from "@unpic/react";
import { ChevronDown } from "lucide-react";

import { useId, useState } from "react";

import {
  MobilePicker as Popover,
  MobilePickerContent as PopoverContent,
  MobilePickerTrigger as PopoverTrigger,
} from "@/components/forms/mobile-picker";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

import { Input } from "@/components/ui/input";

import { CategoryIcon } from "@/features/categories/category-icons";

import { cn } from "@/lib/utils";

export function MultiFilterSelect({
  className,
  hideLabel = false,
  label,
  options,
  placeholder = "Todas",
  selected,
  onChange,
}: {
  className?: string;
  hideLabel?: boolean;
  label: string;
  placeholder?: string;
  options: Array<{
    value: string;
    label: string;
    group?: string;
    avatarUrl?: string | null;
    logoUrl?: string | null;
    categoryIcon?: string | null;
  }>;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const selectedSet = new Set(selected);
  const selectedOptions = options.filter((option) => selectedSet.has(option.value));
  const visibleOptions = options.filter((option) =>
    option.label.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR")),
  );
  const groups = [...new Set(visibleOptions.map((option) => option.group ?? ""))];

  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <span
        className={cn(
          "font-mono font-medium text-muted-foreground text-xs",
          hideLabel && "sr-only",
        )}
      >
        {label}
      </span>
      <Popover>
        <PopoverTrigger
          render={
            <Button
              className="w-full min-w-0 justify-between overflow-hidden bg-transparent font-normal"
              type="button"
              variant="outline"
            />
          }
        >
          <span
            className={cn(
              "flex min-w-0 flex-1 items-center overflow-hidden text-left",
              selected.length ? "text-foreground" : "text-muted-foreground",
            )}
          >
            {selectedOptions.length === 1 ? (
              <FilterOptionContent option={selectedOptions[0]} />
            ) : selected.length ? (
              `${selected.length} selecionado${selected.length > 1 ? "s" : ""}`
            ) : (
              placeholder
            )}
          </span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent
          title={label}
          align="start"
          className="w-[var(--anchor-width)] min-w-64 gap-2 p-2"
        >
          <Input
            aria-label={`Buscar ${label.toLocaleLowerCase("pt-BR")}`}
            onChange={(event) => setQuery(event.target.value)}
            className="placeholder:text-muted-foreground"
            placeholder={`Buscar ${label.toLocaleLowerCase("pt-BR")}...`}
            value={query}
          />
          <div className="max-h-80 overflow-y-auto">
            {groups.map((group) => (
              <div className="grid py-1" key={group || "all"}>
                {group ? (
                  <span className="px-2 py-1.5 font-medium text-muted-foreground text-xs">
                    {group}
                  </span>
                ) : null}
                {visibleOptions
                  .filter((option) => (option.group ?? "") === group)
                  .map((option) => {
                    const checked = selectedSet.has(option.value);
                    return (
                      <label
                        className="flex min-h-11 cursor-pointer items-center gap-2.5 group/option rounded-md px-2 hover:bg-info/10 hover:text-info has-focus-visible:bg-info/10 has-focus-visible:text-info md:min-h-9"
                        htmlFor={`${id}-${option.value}`}
                        key={option.value}
                      >
                        <Checkbox
                          id={`${id}-${option.value}`}
                          aria-label={option.label}
                          checked={checked}
                          onCheckedChange={(next) =>
                            onChange(
                              next
                                ? [...selected, option.value]
                                : selected.filter((value) => value !== option.value),
                            )
                          }
                        />
                        <FilterOptionContent option={option} />
                      </label>
                    );
                  })}
              </div>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function FilterOptionContent({
  option,
}: {
  option: {
    label: string;
    avatarUrl?: string | null;
    logoUrl?: string | null;
    categoryIcon?: string | null;
  };
}) {
  if (option.avatarUrl !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <Avatar size="sm">
          <AvatarImage alt="" src={option.avatarUrl ?? undefined} />
          <AvatarFallback>{option.label.slice(0, 2).toLocaleUpperCase("pt-BR")}</AvatarFallback>
        </Avatar>
        <span className="truncate text-sm">{option.label}</span>
      </span>
    );
  }

  if (option.logoUrl !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        {option.logoUrl ? (
          <Image
            alt=""
            className="size-6 shrink-0 rounded-full object-contain"
            height={24}
            layout="fixed"
            src={option.logoUrl}
            width={24}
          />
        ) : (
          <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted font-medium text-2xs text-muted-foreground">
            {option.label.slice(0, 2).toLocaleUpperCase("pt-BR")}
          </span>
        )}
        <span className="truncate text-sm">{option.label}</span>
      </span>
    );
  }

  if (option.categoryIcon !== undefined) {
    return (
      <span className="flex min-w-0 items-center gap-2">
        <CategoryIcon
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground group-hover/option:text-info group-has-focus-visible/option:text-info"
          name={option.categoryIcon}
        />
        <span className="truncate text-sm">{option.label}</span>
      </span>
    );
  }

  return <span className="truncate text-sm">{option.label}</span>;
}
