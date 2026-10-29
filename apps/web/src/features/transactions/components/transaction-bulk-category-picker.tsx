import type { CategoryOutput } from "@openmonetis/validators/categories";
import { Loader2, Shapes } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import {
  categoryTypeLabels,
  getCategoryLabel,
  sortCategoryOptions,
} from "@/features/categories/categories.presentation";
import { CategoryIcon } from "@/features/categories/category-icons";

export function TransactionBulkCategoryPicker({
  blockedReason,
  busy,
  categories,
  pending,
  onSelect,
}: {
  blockedReason: string | null;
  busy: boolean;
  categories: CategoryOutput[];
  pending: boolean;
  onSelect: (category: CategoryOutput) => void;
}) {
  const [open, setOpen] = useState(false);
  const groups = (["expense", "income"] as const)
    .map((type) => ({
      type,
      categories: sortCategoryOptions(categories.filter((category) => category.type === type)),
    }))
    .filter((group) => group.categories.length);

  return (
    <MobilePicker
      open={open}
      onOpenChange={(next) => {
        if (next && blockedReason) {
          toast.info(blockedReason);
          return;
        }
        setOpen(next);
      }}
    >
      <MobilePickerTrigger
        render={
          <Button
            aria-expanded={open}
            aria-label="Categoria"
            aria-disabled={Boolean(blockedReason)}
            className="aria-disabled:opacity-50"
            disabled={busy}
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        {pending ? (
          <Loader2 aria-hidden="true" className="animate-spin" />
        ) : (
          <Shapes aria-hidden="true" />
        )}
      </MobilePickerTrigger>
      <MobilePickerContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] p-0"
        side="top"
        title="Alterar categoria"
      >
        <Command>
          <CommandInput
            aria-label="Buscar categoria"
            className="text-base md:text-sm"
            placeholder="Buscar categoria"
          />
          <CommandList>
            <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup heading={categoryTypeLabels[group.type]} key={group.type}>
                {group.categories.map((category) => (
                  <CommandItem
                    className={
                      category.parentId ? "min-h-11 pl-6 md:min-h-9" : "min-h-11 md:min-h-9"
                    }
                    key={category.id}
                    onSelect={() => {
                      setOpen(false);
                      onSelect(category);
                    }}
                    value={`${getCategoryLabel(category)} ${category.id}`}
                  >
                    <CategoryIcon aria-hidden="true" className="size-4" name={category.icon} />
                    <span className="truncate">{getCategoryLabel(category)}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </MobilePickerContent>
    </MobilePicker>
  );
}
