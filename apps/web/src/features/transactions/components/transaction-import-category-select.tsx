import type { CategoryOutput } from "@openmonetis/validators/categories";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryOption, Field } from "./transaction-import-options";

export function BulkCategorySelect({
  categories,
  label,
  mixed,
  onChange,
  rowCount,
  value,
}: {
  categories: CategoryOutput[];
  label: string;
  mixed: boolean;
  onChange: (id: string) => void;
  rowCount: number;
  value: string;
}) {
  const selectedCategory = categories.find((category) => category.id === value);
  return (
    <Field label={label}>
      <Select
        disabled={!rowCount}
        onValueChange={(next) => onChange(next as string)}
        value={value || null}
      >
        <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
          <SelectValue
            placeholder={
              !rowCount
                ? "Nenhum lançamento selecionado"
                : mixed
                  ? "Categorias diferentes"
                  : "Selecione uma categoria"
            }
          >
            <CategoryOption
              category={selectedCategory}
              description={`${rowCount} lançamento${rowCount === 1 ? "" : "s"}`}
            />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {categories.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              <CategoryOption category={category} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

export function RowCategorySelect({
  categories,
  disabled,
  onChange,
  value,
}: {
  categories: CategoryOutput[];
  disabled: boolean;
  onChange: (id: string) => void;
  value: string;
}) {
  return (
    <Select disabled={disabled} onValueChange={(next) => onChange(next as string)} value={value}>
      <SelectTrigger className="h-8 w-full">
        <SelectValue placeholder="Categoria">
          <CategoryOption category={categories.find((category) => category.id === value)} compact />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {categories.map((category) => (
          <SelectItem key={category.id} value={category.id}>
            <CategoryOption category={category} compact />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
