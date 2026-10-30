import { createDefaultDashboardWidgetPreferences } from "@openmonetis/domain/dashboard";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isDefaultDashboardWidgetPreferences } from "../dashboard.presentation";
import { useDashboardWidgetEditor } from "../useDashboardWidgetEditor";

export function DashboardRestoreDefaultButton() {
  const { canEdit, preferences, update } = useDashboardWidgetEditor();
  const [open, setOpen] = useState(false);
  const isDefault = isDefaultDashboardWidgetPreferences(preferences);

  function restore() {
    update(() => createDefaultDashboardWidgetPreferences());
    setOpen(false);
    toast.success("Dashboard restaurado ao padrão");
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          aria-label="Restaurar dashboard padrão"
          disabled={!canEdit || isDefault}
          onClick={() => setOpen(true)}
          render={
            <Button
              className="max-md:size-11 text-muted-foreground hover:text-foreground lg:w-auto lg:gap-1.5 lg:px-2.5"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          <RotateCcw aria-hidden="true" />
          <span className="hidden lg:inline">Restaurar padrão</span>
        </TooltipTrigger>
        <TooltipContent>Restaurar dashboard padrão</TooltipContent>
      </Tooltip>
      <AlertDialog onOpenChange={setOpen} open={open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar o dashboard padrão?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os widgets voltam a aparecer, na ordem original de cada grupo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={restore}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
