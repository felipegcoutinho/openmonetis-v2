import type { CategoryOutput } from "@openmonetis/validators/categories";

import { CategoryIcon } from "@/features/categories/category-icons";

export function CategoryOption({ category }: { category?: CategoryOutput }) {
  if (!category) return <span>Selecione</span>;
  return (
    <span className="flex items-center gap-2">
      <CategoryIcon className="size-4" name={category.icon} />
      <span>{category.name}</span>
    </span>
  );
}
