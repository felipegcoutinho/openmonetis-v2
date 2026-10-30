import type { CategoryOutput } from "@openmonetis/validators/categories";
import { ChevronDown, CircleDashed, Plus } from "lucide-react";
import { useState } from "react";
import {
  MobilePicker,
  MobilePickerContent,
  MobilePickerTrigger,
} from "@/components/forms/mobile-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { getCategoryGroups, getCategoryLabel } from "../categories.presentation";
import { CategoryIcon } from "../category-icons";

export function CategoryPicker({
  categories,
  value,
  onChange,
  onCreate,
  disabled,
  invalid,
}: {
  categories: CategoryOutput[];
  value: string;
  onChange: (id: string) => void;
  onCreate: () => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categories.find((category) => category.id === value);
  const groups = getCategoryGroups(categories, search);
  const showEmptyOption =
    !search.trim() || "sem categoria".includes(search.trim().toLocaleLowerCase("pt-BR"));
  function choose(id: string) {
    onChange(id);
    setOpen(false);
  }
  return (
    <MobilePicker
      open={open}
      onOpenChange={(next) => {
        if (next) setSearch("");
        setOpen(next);
      }}
    >
      <MobilePickerTrigger
        data-slot="category-picker-trigger"
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={`Categoria: ${selected ? getCategoryLabel(selected) : "Sem categoria"}`}
            aria-invalid={invalid}
            disabled={disabled}
            className="w-full justify-start overflow-hidden font-normal"
          />
        }
      >
        {selected ? (
          <CategoryIcon aria-hidden="true" className="size-4 shrink-0" name={selected.icon} />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-left">
          {selected?.parentName ? (
            <span className="text-muted-foreground">{selected.parentName} › </span>
          ) : null}
          {selected ? selected.name : <span className="text-muted-foreground">Sem categoria</span>}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </MobilePickerTrigger>
      <MobilePickerContent
        title="Categoria"
        align="start"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <Command shouldFilter={false}>
          <CommandInput
            className="text-base md:text-sm"
            value={search}
            onValueChange={setSearch}
            aria-label="Buscar categoria"
            placeholder="Buscar categoria"
          />
          <CommandList className="max-h-80 p-1">
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            {showEmptyOption ? (
              <CommandItem
                className="min-h-11 text-muted-foreground md:min-h-9"
                value="none"
                data-checked={!value}
                onSelect={() => choose("")}
              >
                <CircleDashed aria-hidden="true" className="size-4" />
                Sem categoria
              </CommandItem>
            ) : null}
            {groups.map(({ parent, children }) => (
              <CommandGroup key={parent.id} className="p-0">
                <CommandItem
                  className="min-h-11 font-medium md:min-h-9"
                  value={parent.id}
                  data-checked={parent.id === value}
                  onSelect={() => choose(parent.id)}
                >
                  <CategoryIcon aria-hidden="true" className="size-4" name={parent.icon} />
                  <span className="truncate">{parent.name}</span>
                </CommandItem>
                {children.length > 0 ? (
                  <div className="ml-4 border-l pl-2">
                    {children.map((child) => (
                      <CommandItem
                        className="min-h-11 md:min-h-9"
                        key={child.id}
                        value={child.id}
                        aria-label={getCategoryLabel(child)}
                        data-checked={child.id === value}
                        onSelect={() => choose(child.id)}
                      >
                        <span className="truncate">{child.name}</span>
                      </CommandItem>
                    ))}
                  </div>
                ) : null}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
        <div className="border-t p-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start text-muted-foreground"
            onClick={() => {
              setOpen(false);
              onCreate();
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            Criar categoria
          </Button>
        </div>
      </MobilePickerContent>
    </MobilePicker>
  );
}
