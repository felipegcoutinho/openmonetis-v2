import type {
  CategoryOutput,
  CreateCategoryInput,
  ReplaceCategoryInput,
} from "@openmonetis/validators/categories";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryForm } from "./category-form";
export function CategoryDialog({
  category,
  onOpenChange,
  onSubmit,
  open,
}: {
  category: CategoryOutput | null;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateCategoryInput | ReplaceCategoryInput) => Promise<void>;
  open: boolean;
}) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{category ? "Atualizar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            {category
              ? "Atualize os detalhes da categoria."
              : "Crie uma categoria para organizar seus lançamentos."}
          </DialogDescription>
        </DialogHeader>
        <CategoryForm
          key={category?.id ?? "new-category"}
          category={category}
          onCancel={() => onOpenChange(false)}
          onSubmit={onSubmit}
        />
      </DialogContent>
    </Dialog>
  );
}
