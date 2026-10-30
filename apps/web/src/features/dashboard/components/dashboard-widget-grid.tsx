import type { DashboardWidgetId } from "@openmonetis/domain/dashboard";
import { LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  hideDashboardWidget,
  moveDashboardWidget,
  showDashboardWidget,
} from "../dashboard.presentation";
import { useDashboardWidgetEditor } from "../useDashboardWidgetEditor";
import { DashboardAddWidgetDialog } from "./dashboard-add-widget-dialog";
import { DashboardWidgetControlsContext } from "./dashboard-widget-menu";
import {
  type DashboardWidgetDefinition,
  dashboardWidgetById,
  dashboardWidgetRegistry,
  dashboardWidgetSections,
} from "./dashboard-widget-registry";

/**
 * Widgets wrap in rows of up to three (two on medium screens) and grow to share what is left of
 * their row, so a section never ends with an empty gap. A wide widget counts as two.
 */
const widgetSlotClassName =
  "min-w-0 grow basis-full md:basis-[calc((100%-1rem)/2)] xl:basis-[calc((100%-2rem)/3)]";
const wideWidgetSlotClassName = "min-w-0 grow basis-full xl:basis-[calc((100%-2rem)/3*2+1rem)]";

/** Swap the widget row for a short notice when every widget collapsed for lack of data. */
const widgetRowClassName =
  "flex flex-wrap gap-4 [section[data-dashboard-section]:not(:has([data-dashboard-widget-slot]:not(:has([data-dashboard-widget-collapse]))))_&]:hidden";
const collapsedNoticeClassName =
  "hidden rounded-card border border-dashed px-4 py-3 text-muted-foreground text-sm [section[data-dashboard-section]:not(:has([data-dashboard-widget-slot]:not(:has([data-dashboard-widget-collapse]))))_&]:block";

export function DashboardWidgetGrid({
  excludedWidgetIds = [],
  period,
  placeBillsAfterInvoices = false,
  sectionHeadingLevel = "h2",
}: {
  excludedWidgetIds?: readonly DashboardWidgetId[];
  period: string;
  placeBillsAfterInvoices?: boolean;
  /** Use "h3" when the grid is rendered under another section heading. */
  sectionHeadingLevel?: "h2" | "h3";
}) {
  const SectionHeading = sectionHeadingLevel;
  const { canEdit, preferences, preferencesQuery, update } = useDashboardWidgetEditor();
  const excludedWidgets = new Set<DashboardWidgetId>([...excludedWidgetIds, "attention"]);
  const visibleWidgets = preferences.order.flatMap((widgetId) => {
    const widget = dashboardWidgetById.get(widgetId);
    return widget && !preferences.hidden.includes(widgetId) && !excludedWidgets.has(widgetId)
      ? [widget]
      : [];
  });
  if (placeBillsAfterInvoices) {
    const invoicesIndex = visibleWidgets.findIndex((widget) => widget.id === "invoices");
    const billsIndex = visibleWidgets.findIndex((widget) => widget.id === "bills");
    if (invoicesIndex >= 0 && billsIndex >= 0) {
      const [bills] = visibleWidgets.splice(billsIndex, 1);
      const nextInvoicesIndex = visibleWidgets.findIndex((widget) => widget.id === "invoices");
      visibleWidgets.splice(nextInvoicesIndex + 1, 0, bills);
    }
  }

  function addWidget(widget: DashboardWidgetDefinition) {
    const sectionWidgetIds = dashboardWidgetRegistry
      .filter((candidate) => candidate.section === widget.section)
      .map((candidate) => candidate.id);
    update((current) => showDashboardWidget(current, widget.id, sectionWidgetIds));
    toast.success(`${widget.title} adicionado ao dashboard`);
  }

  function removeWidget(widget: DashboardWidgetDefinition) {
    update((current) => hideDashboardWidget(current, widget.id));
    toast.success(`${widget.title} removido do dashboard`, {
      action: {
        label: "Desfazer",
        onClick: () => addWidget(widget),
      },
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {preferencesQuery.isError ? (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            Não foi possível carregar suas preferências. Exibindo a organização padrão.
          </p>
          <Button
            className="shrink-0"
            onClick={() => void preferencesQuery.refetch()}
            size="sm"
            variant="outline"
          >
            Tentar novamente
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8">
        {dashboardWidgetSections.map((section) => {
          const sectionWidgets = visibleWidgets.filter((widget) => widget.section === section.id);
          const availableWidgets = dashboardWidgetRegistry.filter(
            (widget) =>
              widget.section === section.id &&
              preferences.hidden.includes(widget.id) &&
              (widget.id === "attention" || !excludedWidgets.has(widget.id)),
          );
          const titleId = `dashboard-section-${section.id}`;

          return (
            <section
              aria-labelledby={titleId}
              className="grid grid-cols-1 gap-3"
              data-dashboard-section
              key={section.id}
            >
              <div className="flex items-center gap-2">
                <SectionHeading
                  className="font-heading font-medium text-muted-foreground text-sm"
                  id={titleId}
                >
                  {section.title}
                </SectionHeading>
                <DashboardAddWidgetDialog
                  availableWidgets={availableWidgets}
                  disabled={!canEdit}
                  onAdd={addWidget}
                  sectionTitle={section.title}
                />
              </div>

              {sectionWidgets.length > 0 ? (
                <>
                  <div className={widgetRowClassName}>
                    {sectionWidgets.map((widget, index) => {
                      const previous = sectionWidgets[index - 1];
                      const next = sectionWidgets[index + 1];

                      return (
                        <div
                          className={cn(
                            widget.wide ? wideWidgetSlotClassName : widgetSlotClassName,
                            "has-[[data-dashboard-widget-collapse]]:hidden",
                          )}
                          data-dashboard-widget-slot
                          key={widget.id}
                        >
                          <DashboardWidgetControlsContext
                            value={
                              canEdit
                                ? {
                                    onMoveBack: previous
                                      ? () =>
                                          update((current) =>
                                            moveDashboardWidget(current, widget.id, previous.id),
                                          )
                                      : undefined,
                                    onMoveForward: next
                                      ? () =>
                                          update((current) =>
                                            moveDashboardWidget(current, widget.id, next.id),
                                          )
                                      : undefined,
                                    onRemove: () => removeWidget(widget),
                                    title: widget.title,
                                  }
                                : null
                            }
                          >
                            {widget.render(period)}
                          </DashboardWidgetControlsContext>
                        </div>
                      );
                    })}
                  </div>
                  <p className={collapsedNoticeClassName}>
                    Nenhum dado neste mês para os widgets deste grupo.
                  </p>
                </>
              ) : (
                <div className="flex items-center gap-3 rounded-card border border-dashed px-4 py-3 text-muted-foreground text-sm">
                  <LayoutGrid aria-hidden="true" className="size-4 shrink-0" />
                  Nenhum widget neste grupo. Use Adicionar para escolher o que acompanhar.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
