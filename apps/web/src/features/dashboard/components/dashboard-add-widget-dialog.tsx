import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardWidgetDefinition } from "./dashboard-widget-registry";

export function DashboardAddWidgetDialog({
  availableWidgets,
  disabled = false,
  onAdd,
  sectionTitle,
}: {
  availableWidgets: readonly DashboardWidgetDefinition[];
  disabled?: boolean;
  onAdd: (widget: DashboardWidgetDefinition) => void;
  sectionTitle: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        aria-label={`Adicionar widget em ${sectionTitle}`}
        className="max-md:h-11 text-muted-foreground hover:text-foreground"
        disabled={disabled}
        onClick={() => setOpen(true)}
        size="xs"
        type="button"
        variant="ghost"
      >
        <Plus aria-hidden="true" />
        Adicionar
      </Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar em {sectionTitle}</DialogTitle>
            <DialogDescription>
              {availableWidgets.length > 0
                ? "Escolha o que você quer acompanhar neste grupo."
                : "Todos os widgets deste grupo já estão no dashboard."}
            </DialogDescription>
          </DialogHeader>
          {availableWidgets.length > 0 ? (
            <ul className="-mx-2 grid gap-1">
              {availableWidgets.map((widget) => (
                <li key={widget.id}>
                  <button
                    className="flex w-full min-w-0 items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    onClick={() => onAdd(widget)}
                    type="button"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-strong">
                      <widget.icon aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-sm">{widget.title}</span>
                      <span className="mt-0.5 block text-muted-foreground text-xs">
                        {widget.description}
                      </span>
                    </span>
                    <Plus aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
