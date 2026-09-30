import type { CategoryOutput } from "@openmonetis/validators/categories";
import { Link } from "@tanstack/react-router";
import { ChevronRight, LockKeyhole, Pencil, Trash2 } from "lucide-react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
    <>
      <ul className="divide-y sm:hidden">
        {categories.map((category) => (
          <li className="flex min-w-0 items-center gap-3 py-2.5" key={category.id}>
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <CategoryIcon className="size-4" name={category.icon} />
            </span>
            <Link
              className="min-w-0 flex-1 truncate font-medium"
              params={{ categoryId: category.id }}
              to="/categories/$categoryId"
            >
              {category.name}
            </Link>
            {category.isSystem ? (
              <Tooltip>
                <TooltipTrigger
                  aria-label={`Por que ${category.name} é automática?`}
                  render={
                    <Button
                      className="shrink-0 text-muted-foreground"
                      size="icon-sm"
                      variant="ghost"
                    />
                  }
                >
                  <LockKeyhole aria-hidden="true" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  Criada pelo sistema para operações automáticas. Esta categoria não pode ser
                  editada ou removida.
                </TooltipContent>
              </Tooltip>
            ) : (
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  aria-label={`Editar ${category.name}`}
                  onClick={() => onEdit(category)}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Pencil aria-hidden="true" />
                </Button>
                <RemoveAction
                  category={category}
                  onRemove={onRemove}
                  pending={pendingId === category.id}
                />
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="hidden sm:block">
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
                    <ChevronRight className="size-3 text-muted-foreground" />
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    {category.isSystem ? (
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded px-2 text-muted-foreground text-xs focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          }
                          aria-label={`Por que ${category.name} é automática?`}
                        >
                          <LockKeyhole aria-hidden="true" className="size-3.5" />
                          Automática
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          Criada pelo sistema para operações automáticas. Esta categoria não pode
                          ser editada ou removida.
                        </TooltipContent>
                      </Tooltip>
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
      </div>
    </>
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
            A categoria &quot;{category.name}&quot; será removida. Se ela estiver vinculada a
            lançamentos ou recorrências, altere a categoria desses registros antes de excluir.
            Orçamentos vinculados também precisam ser removidos primeiro.
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
