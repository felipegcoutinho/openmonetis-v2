import { ArrowLeft, ArrowRight, EllipsisVertical, EyeOff } from "lucide-react";
import { createContext, useContext } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type DashboardWidgetControls = {
  onMoveBack?: () => void;
  onMoveForward?: () => void;
  onRemove: () => void;
  title: string;
};

/** Provided by the dashboard grid, so each widget card shows its menu without knowing the grid. */
export const DashboardWidgetControlsContext = createContext<DashboardWidgetControls | null>(null);

export function useDashboardWidgetControls() {
  return useContext(DashboardWidgetControlsContext);
}

export function DashboardWidgetMenu({ controls }: { controls: DashboardWidgetControls }) {
  const canMove = Boolean(controls.onMoveBack || controls.onMoveForward);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={`Opções de ${controls.title}`}
            className="max-md:size-11 text-muted-foreground hover:text-foreground"
            size="icon-sm"
            type="button"
            variant="ghost"
          />
        }
      >
        <EllipsisVertical aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {canMove ? (
          <>
            <DropdownMenuItem disabled={!controls.onMoveBack} onClick={controls.onMoveBack}>
              <ArrowLeft aria-hidden="true" /> Mover para trás
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!controls.onMoveForward} onClick={controls.onMoveForward}>
              <ArrowRight aria-hidden="true" /> Mover para frente
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        <DropdownMenuItem onClick={controls.onRemove}>
          <EyeOff aria-hidden="true" /> Remover do dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
