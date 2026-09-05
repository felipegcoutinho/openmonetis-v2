import type { CategoryOutput } from "@openmonetis/validators/categories";
import { Link } from "@tanstack/react-router";
import { ExternalLink, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CategoryIcon } from "../category-icons";

export function CategoriesTable({
  categories,
  onEdit,
  onRemove,
  pendingId,
}: {
  categories: CategoryOutput[];
  onEdit: (category: CategoryOutput) => void;
  onRemove: (category: CategoryOutput) => Promise<void>;
  pendingId?: string | null;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-14">
            <span className="sr-only">Ícone</span>
          </TableHead>
          <TableHead>Nome</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories.map((category) => (
          <TableRow key={category.id}>
            <TableCell>
              <span className="grid size-9 place-items-center rounded-full bg-muted text-muted-foreground">
                <CategoryIcon className="size-4" name={category.icon} />
              </span>
            </TableCell>
            <TableCell>
              <Link
                className="inline-flex items-center gap-1 font-medium hover:text-brand-strong"
                params={{ categoryId: category.id }}
                to="/categories/$categoryId"
              >
                {category.name}
                <ExternalLink className="size-3 text-muted-foreground" />
              </Link>
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                {category.isSystem ? (
                  <span className="inline-flex items-center gap-1.5 px-2 text-muted-foreground text-xs">
                    <LockKeyhole aria-hidden="true" className="size-3.5" />
                    Sistema
                  </span>
                ) : (
                  <>
                    <Button
                      aria-label={`Editar ${category.name}`}
                      onClick={() => onEdit(category)}
                      size="icon"
                      variant="ghost"
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <RemoveAction
                      category={category}
                      onRemove={onRemove}
                      pending={pendingId === category.id}
                    />
                  </>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
function RemoveAction({
  category,
  onRemove,
  pending,
}: {
  category: CategoryOutput;
  onRemove: (category: CategoryOutput) => Promise<void>;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <AlertDialog onOpenChange={setOpen} open={open}>
      <Button
        aria-label={`Remover ${category.name}`}
        disabled={pending}
        onClick={() => setOpen(true)}
        size="icon"
        variant="ghost"
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remover categoria?</AlertDialogTitle>
          <AlertDialogDescription>
            A categoria &quot;{category.name}&quot; será removida.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() => {
              void onRemove(category).then(() => setOpen(false));
            }}
            variant="destructive"
          >
            {pending ? "Removendo..." : "Remover"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
