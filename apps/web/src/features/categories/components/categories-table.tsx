import type { CategoryOutput, CreateCategoryInput } from "@openmonetis/validators/categories";
import { Link } from "@tanstack/react-router";
import { LockKeyhole, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { CardActionsMenu } from "@/components/card-actions-menu";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCategoryGroups, getCategoryLabel } from "../categories.presentation";
import { CategoryIcon } from "../category-icons";
import { SubcategoryForm } from "./subcategory-form";

export function CategoriesTable({
  categories,
  search = "",
  onEdit,
  onRemove,
  onCreateSubcategory,
  pendingId,
}: {
  categories: CategoryOutput[];
  search?: string;
  onEdit: (category: CategoryOutput) => void;
  onRemove: (category: CategoryOutput) => Promise<void>;
  onCreateSubcategory: (input: CreateCategoryInput) => Promise<void>;
  pendingId?: string | null;
}) {
  const [addingParentId, setAddingParentId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [searchExpansion, setSearchExpansion] = useState<{ query: string; ids: string[] } | null>(
    null,
  );
  const query = search.trim();
  const groups = getCategoryGroups(categories, search);
  const visibleIds = query
    ? searchExpansion?.query === query
      ? searchExpansion.ids
      : groups.map(({ parent }) => parent.id)
    : expandedIds;
  const openIds = addingParentId ? [...new Set([...visibleIds, addingParentId])] : visibleIds;
  return (
    <Accordion
      multiple
      value={openIds}
      onValueChange={(ids: string[]) => {
        if (query) setSearchExpansion({ query, ids });
        else setExpandedIds(ids);
      }}
    >
      {groups.map(({ parent, children }) => (
        <AccordionItem className="py-3 first:pt-0 last:pb-0" key={parent.id} value={parent.id}>
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
              <CategoryIcon className="size-4" name={parent.icon} />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                className="block truncate font-medium hover:text-brand-strong"
                params={{ categoryId: parent.id }}
                to="/categories/$categoryId"
              >
                {parent.name}
              </Link>
              {children.length > 0 ? (
                <AccordionTrigger
                  className="min-h-6 w-fit flex-none items-center justify-start gap-1.5 p-0 text-muted-foreground text-xs font-normal hover:text-foreground hover:no-underline [&_[data-slot=accordion-trigger-icon]]:ml-0"
                  aria-label={`${openIds.includes(parent.id) ? "Recolher" : "Expandir"} subcategorias de ${parent.name}`}
                >
                  {children.length} {children.length === 1 ? "subcategoria" : "subcategorias"}
                  {query ? " na busca" : ""}
                </AccordionTrigger>
              ) : null}
            </div>
            <CategoryActions
              category={parent}
              onAddSubcategory={() => {
                setExpandedIds((ids) => [...new Set([...ids, parent.id])]);
                setAddingParentId(parent.id);
              }}
              onEdit={onEdit}
              onRemove={onRemove}
              pending={pendingId === parent.id}
            />
          </div>
          <AccordionContent className="pb-0 [&_a]:no-underline">
            {children.length ? (
              <ul aria-label={`Subcategorias de ${parent.name}`} className="mt-2 ml-4 pl-3 sm:pl-5">
                {children.map((child) => (
                  <li
                    className="flex min-w-0 items-center gap-2 rounded-md px-2 hover:bg-muted/50 focus-within:bg-muted/50"
                    key={child.id}
                  >
                    <Link
                      className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md py-2 text-sm hover:text-brand-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      params={{ categoryId: child.id }}
                      to="/categories/$categoryId"
                      aria-label={getCategoryLabel(child)}
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted-foreground text-muted">
                        <CategoryIcon className="size-4" name={parent.icon} />
                      </span>
                      <span className="min-w-0 break-words">{child.name}</span>
                    </Link>
                    <CategoryActions
                      category={child}
                      onEdit={onEdit}
                      onRemove={onRemove}
                      pending={pendingId === child.id}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {addingParentId === parent.id ? (
              <div className="mt-3 sm:ml-11">
                <SubcategoryForm
                  key={parent.id}
                  parent={parent}
                  onCancel={() => setAddingParentId(null)}
                  onSubmit={onCreateSubcategory}
                />
              </div>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function CategoryActions({
  category,
  onAddSubcategory,
  onEdit,
  onRemove,
  pending,
}: {
  category: CategoryOutput;
  onAddSubcategory?: () => void;
  onEdit: (category: CategoryOutput) => void;
  onRemove: (category: CategoryOutput) => Promise<void>;
  pending: boolean;
}) {
  if (category.isSystem)
    return (
      <Tooltip>
        <TooltipTrigger
          aria-label={`Por que ${category.name} é automática?`}
          render={<Button variant="ghost" size="icon" />}
        >
          <LockKeyhole aria-hidden="true" className="size-4 text-muted-foreground" />
        </TooltipTrigger>
        <TooltipContent>
          Criada pelo sistema. Esta categoria não pode ser editada ou removida.
        </TooltipContent>
      </Tooltip>
    );
  return <EditableCategoryActions {...{ category, onAddSubcategory, onEdit, onRemove, pending }} />;
}

function EditableCategoryActions({
  category,
  onAddSubcategory,
  onEdit,
  onRemove,
  pending,
}: {
  category: CategoryOutput;
  onAddSubcategory?: () => void;
  onEdit: (category: CategoryOutput) => void;
  onRemove: (category: CategoryOutput) => Promise<void>;
  pending: boolean;
}) {
  const [removeOpen, setRemoveOpen] = useState(false);
  const label = getCategoryLabel(category);

  return (
    <>
      <CardActionsMenu className="ml-0" disabled={pending} label={`Mais ações para ${label}`}>
        <DropdownMenuItem onClick={() => onEdit(category)}>
          <Pencil aria-hidden="true" /> Editar
        </DropdownMenuItem>
        {onAddSubcategory ? (
          <DropdownMenuItem onClick={onAddSubcategory}>
            <Plus aria-hidden="true" /> Adicionar subcategoria
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setRemoveOpen(true)} variant="destructive">
          <Trash2 aria-hidden="true" /> Remover
        </DropdownMenuItem>
      </CardActionsMenu>
      <RemoveCategoryDialog
        category={category}
        onOpenChange={setRemoveOpen}
        onRemove={onRemove}
        open={removeOpen}
        pending={pending}
      />
    </>
  );
}

function RemoveCategoryDialog({
  category,
  onOpenChange,
  onRemove,
  open,
  pending,
}: {
  category: CategoryOutput;
  onOpenChange: (open: boolean) => void;
  onRemove: (category: CategoryOutput) => Promise<void>;
  open: boolean;
  pending: boolean;
}) {
  return (
    <AlertDialog onOpenChange={onOpenChange} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {category.parentId ? "Remover subcategoria?" : "Remover categoria?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            A categoria &quot;{category.name}&quot; será removida. Se ela estiver vinculada a
            lançamentos ou recorrências, altere a categoria desses registros antes de excluir.
            Orçamentos vinculados também precisam ser removidos primeiro. Categorias com
            subcategorias só podem ser removidas depois de mover ou excluir suas filhas.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={() => {
              void onRemove(category).then(() => onOpenChange(false));
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
