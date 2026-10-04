import {
  createDefaultDashboardWidgetPreferences,
  type DashboardWidgetId,
  type DashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Check, LoaderCircle, PanelsTopLeft, RotateCcw } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useSaveDashboardWidgetPreferencesMutation } from "../dashboard.mutations";
import {
  areDashboardWidgetPreferencesEqual,
  moveDashboardWidget,
  toggleDashboardWidget,
} from "../dashboard.presentation";
import { dashboardWidgetPreferencesQueryOptions } from "../dashboard.queries";
import {
  type DashboardWidgetDefinition,
  dashboardWidgetById,
  dashboardWidgetRegistry,
} from "./dashboard-widget-registry";

const moveHighlightDurationMs = 3000;
const moveHighlightHoldOffset = 0.2;
const moveHighlightBackground = "color-mix(in srgb, var(--primary) 18%, var(--card))";

export function DashboardCustomizer() {
  const defaults = createDefaultDashboardWidgetPreferences();
  const preferencesQuery = useQuery({
    ...dashboardWidgetPreferencesQueryOptions(),
  });
  const savedPreferences = preferencesQuery.data ?? defaults;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DashboardWidgetPreferences | null>(null);
  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    setDraft(nextOpen ? savedPreferences : null);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <Tooltip>
        <TooltipTrigger
          aria-label="Personalizar dashboard"
          disabled={!preferencesQuery.data}
          onClick={() => handleOpenChange(true)}
          render={
            <Button
              className="max-md:size-11 text-muted-foreground hover:text-foreground"
              size="icon-sm"
              type="button"
              variant="ghost"
            />
          }
        >
          {preferencesQuery.isPending ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <PanelsTopLeft aria-hidden="true" />
          )}
        </TooltipTrigger>
        <TooltipContent>Personalizar dashboard</TooltipContent>
      </Tooltip>
      <SheetContent className="min-w-0 gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader className="shrink-0 border-b pr-14">
          <SheetTitle>Personalizar dashboard</SheetTitle>
          <SheetDescription>
            Escolha o que aparece e organize os widgets na ordem mais útil para você.
          </SheetDescription>
        </SheetHeader>

        {draft ? (
          <DashboardCustomizationEditor
            draft={draft}
            onChange={setDraft}
            onClose={() => handleOpenChange(false)}
            savedPreferences={savedPreferences}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DashboardCustomizationEditor({
  draft,
  onChange,
  onClose,
  savedPreferences,
}: {
  draft: DashboardWidgetPreferences;
  onChange: (preferences: DashboardWidgetPreferences) => void;
  onClose: () => void;
  savedPreferences: DashboardWidgetPreferences;
}) {
  const saveMutation = useSaveDashboardWidgetPreferencesMutation();
  const [lastMove, setLastMove] = useState<{
    revision: number;
    widgetId: DashboardWidgetId;
  } | null>(null);
  const isDirty = !areDashboardWidgetPreferencesEqual(draft, savedPreferences);
  const visibleCount = dashboardWidgetRegistry.length - draft.hidden.length;

  function handleMove(widgetId: DashboardWidgetId, direction: -1 | 1) {
    onChange(moveDashboardWidget(draft, widgetId, direction));
    setLastMove((current) => ({
      revision: (current?.revision ?? 0) + 1,
      widgetId,
    }));
  }

  async function handleSave() {
    try {
      await saveMutation.mutateAsync(draft);
      toast.success("Dashboard atualizado");
      onClose();
    } catch {
      toast.error("Não foi possível salvar. Tente novamente.");
    }
  }

  return (
    <>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-2 border-b bg-popover/95 px-4 py-3 backdrop-blur">
          <p className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{visibleCount}</span> visíveis
          </p>
          <Button
            className="gap-2"
            disabled={saveMutation.isPending}
            onClick={() => onChange(createDefaultDashboardWidgetPreferences())}
            size="sm"
            variant="ghost"
          >
            <RotateCcw aria-hidden="true" className="size-3.5" />
            Restaurar padrão
          </Button>
        </div>

        <ol className="grid min-w-0 grid-cols-1 gap-2 p-4">
          {draft.order.map((widgetId, index) => {
            const widget = dashboardWidgetById.get(widgetId);
            return widget ? (
              <DashboardWidgetEditorItem
                index={index}
                isVisible={!draft.hidden.includes(widgetId)}
                key={widgetId}
                moveRevision={lastMove?.widgetId === widgetId ? lastMove.revision : 0}
                onMove={(direction) => handleMove(widgetId, direction)}
                onToggle={() => onChange(toggleDashboardWidget(draft, widgetId))}
                total={draft.order.length}
                widget={widget}
              />
            ) : null;
          })}
        </ol>
      </div>

      <SheetFooter className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] border-t bg-popover pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-[auto_auto] sm:justify-end">
        <Button disabled={saveMutation.isPending} onClick={onClose} variant="outline">
          Cancelar
        </Button>
        <Button disabled={!isDirty || saveMutation.isPending} onClick={() => void handleSave()}>
          {saveMutation.isPending ? (
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <Check aria-hidden="true" className="size-4" />
          )}
          Salvar alterações
        </Button>
      </SheetFooter>
    </>
  );
}

function DashboardWidgetEditorItem({
  index,
  isVisible,
  moveRevision,
  onMove,
  onToggle,
  total,
  widget,
}: {
  index: number;
  isVisible: boolean;
  moveRevision: number;
  onMove: (direction: -1 | 1) => void;
  onToggle: () => void;
  total: number;
  widget: DashboardWidgetDefinition;
}) {
  const checkboxId = useId();
  const itemRef = useRef<HTMLLIElement>(null);
  const Icon = widget.icon;

  useEffect(() => {
    const item = itemRef.current;
    if (
      !item ||
      moveRevision === 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const naturalBackground = getComputedStyle(item).backgroundColor;
    const animation = item.animate(
      [
        {
          backgroundColor: moveHighlightBackground,
        },
        {
          backgroundColor: moveHighlightBackground,
          offset: moveHighlightHoldOffset,
        },
        { backgroundColor: naturalBackground },
      ],
      {
        duration: moveHighlightDurationMs,
        easing: "ease-in-out",
      },
    );

    return () => animation.cancel();
  }, [moveRevision]);

  return (
    <li
      className={cn(
        "grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-lg border bg-card p-3 transition-colors sm:grid-cols-[auto_minmax(0,1fr)_auto_auto]",
        !isVisible && "bg-muted/35 text-muted-foreground",
      )}
      ref={itemRef}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand-strong">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <label className="min-w-0 flex-1 cursor-pointer" htmlFor={checkboxId}>
        <span className="block break-words font-medium text-sm">{widget.title}</span>
        <span className="mt-0.5 block break-words text-muted-foreground text-xs">
          {widget.description}
        </span>
      </label>
      <div className="col-start-2 row-start-2 flex items-center gap-1 sm:col-start-3 sm:row-start-1">
        <Button
          aria-label={`Mover ${widget.title} para cima`}
          disabled={index === 0}
          onClick={() => onMove(-1)}
          className="max-sm:size-11"
          size="icon-sm"
          title="Mover para cima"
          variant="ghost"
        >
          <ArrowUp aria-hidden="true" />
        </Button>
        <Button
          aria-label={`Mover ${widget.title} para baixo`}
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          className="max-sm:size-11"
          size="icon-sm"
          title="Mover para baixo"
          variant="ghost"
        >
          <ArrowDown aria-hidden="true" />
        </Button>
      </div>
      <Checkbox
        aria-label={`${isVisible ? "Ocultar" : "Exibir"} ${widget.title}`}
        checked={isVisible}
        className="col-start-3 row-start-1 sm:col-start-4"
        id={checkboxId}
        onCheckedChange={onToggle}
      />
    </li>
  );
}
