import { findDueDateRuleConflicts } from "@openmonetis/domain/due-date-rules";
import type {
  DueDateRuleOptions,
  DueDateRulesOutput,
} from "@openmonetis/validators/due-date-rules";
import { useQuery } from "@tanstack/react-query";
import { ListChecks, Plus } from "lucide-react";
import { useState } from "react";
import { UnsavedChangesGuard } from "@/components/forms/unsaved-changes-guard";
import { SettingsPanel, SettingsSection } from "@/components/settings-panel";
import { SettingsQueryError } from "@/components/settings-query-error";
import { Accordion } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createDueDateRule, formatDueDate } from "../due-date-rules.presentation";
import {
  dueDateRuleOptionsQueryOptions,
  dueDateRulesQueryOptions,
} from "../due-date-rules.queries";
import { useDueDateRulesForm } from "../useDueDateRulesForm";
import { DueDateRuleItem } from "./due-date-rule-item";
import { DueDateRulesCalendar } from "./due-date-rules-calendar";
export function DueDateRulesPage() {
  const config = useQuery(dueDateRulesQueryOptions());
  const options = useQuery(dueDateRuleOptionsQueryOptions());
  if (config.isPending || options.isPending) return <Skeleton className="h-80 rounded-xl" />;
  if (!config.data || !options.data)
    return (
      <SettingsQueryError
        message="Não foi possível carregar as regras de vencimento."
        isRetrying={config.isFetching || options.isFetching}
        onRetry={() => {
          void config.refetch();
          void options.refetch();
        }}
      />
    );
  return (
    <DueDateRulesEditor key={config.data.revision} config={config.data} options={options.data} />
  );
}
function DueDateRulesEditor({
  config,
  options,
}: {
  config: DueDateRulesOutput;
  options: DueDateRuleOptions;
}) {
  const { form, preview, previewFingerprint, calculatePreview, discardChanges } =
    useDueDateRulesForm(config);
  const [openRuleIds, setOpenRuleIds] = useState<string[]>([]);
  return (
    <form
      className="grid min-w-0 gap-4"
      data-mobile-page-form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({
          values: state.values,
          isSubmitting: state.isSubmitting,
          isDirty: !state.isDefaultValue,
        })}
      >
        {({ values, isSubmitting, isDirty }) => {
          const disabled = isSubmitting || preview.isPending;
          const previewCurrent = previewFingerprint === JSON.stringify(values);
          const conflictingRuleIds = findDueDateRuleConflicts(values.rules);
          return (
            <>
              <SettingsPanel>
                <SettingsSection
                  icon={ListChecks}
                  title="Personalizações e exceções"
                  description="Por padrão, contas a pagar e faturas que vencem em fins de semana e feriados passam para o próximo dia útil. Crie regras para mudar isso."
                >
                  <form.Field name="rules">
                    {(field) => (
                      <div className="grid gap-4">
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          As regras valem para vencimentos de hoje em diante e cada item pode ser
                          abrangido por uma única regra. Pagamentos confirmados mantêm suas datas.
                        </p>
                        {field.state.value.length ? (
                          <Accordion
                            className="gap-2"
                            multiple
                            onValueChange={(ids: string[]) => setOpenRuleIds(ids)}
                            value={openRuleIds}
                          >
                            {field.state.value.map((rule, index) => (
                              <DueDateRuleItem
                                conflicting={conflictingRuleIds.has(rule.id)}
                                disabled={disabled}
                                key={rule.id}
                                onChange={(next) =>
                                  field.handleChange(
                                    field.state.value.map((item, i) => (i === index ? next : item)),
                                  )
                                }
                                onRemove={() =>
                                  field.handleChange(
                                    field.state.value.filter((item) => item.id !== rule.id),
                                  )
                                }
                                options={options}
                                rule={rule}
                              />
                            ))}
                          </Accordion>
                        ) : (
                          <p className="rounded-lg border border-dashed p-5 text-muted-foreground text-sm">
                            Nenhuma personalização cadastrada. Contas a pagar e faturas usam o
                            próximo dia útil automaticamente.
                          </p>
                        )}
                        <Button
                          className="justify-self-start"
                          type="button"
                          variant="outline"
                          disabled={disabled || field.state.value.length >= 50}
                          onClick={() => {
                            const rule = createDueDateRule();
                            field.handleChange([...field.state.value, rule]);
                            setOpenRuleIds((ids) => [...ids, rule.id]);
                          }}
                        >
                          <Plus aria-hidden="true" className="size-4" />
                          Adicionar personalização
                        </Button>
                      </div>
                    )}
                  </form.Field>
                </SettingsSection>
                <DueDateRulesCalendar form={form} disabled={disabled} />
              </SettingsPanel>
              {previewCurrent && preview.data ? (
                <section className="grid gap-3 rounded-xl border p-5" aria-live="polite">
                  <h2 className="font-medium">Prévia dos vencimentos</h2>
                  <p className="text-muted-foreground text-sm">
                    De {formatDueDate(preview.data.from)} a {formatDueDate(preview.data.through)} ·{" "}
                    {preview.data.items.length === 1
                      ? "1 vencimento será alterado."
                      : `${preview.data.items.length} vencimentos serão alterados.`}
                  </p>
                  {preview.data.items.length ? (
                    <ul className="grid max-h-80 gap-3 overflow-y-auto">
                      {preview.data.items.map((item) => (
                        <li
                          key={item.id}
                          className="grid gap-1 border-b pb-3 text-sm last:border-0"
                        >
                          <span className="font-medium">{item.name}</span>
                          <span>
                            {formatDueDate(item.currentDueDate)} → {formatDueDate(item.dueDate)}
                          </span>
                          <span className="text-muted-foreground text-xs">
                            Original: {formatDueDate(item.originalDueDate)}
                            {item.ruleName
                              ? ` · ${item.ruleName}`
                              : item.dueDate === item.originalDueDate
                                ? " · data original"
                                : " · ajuste automático"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nenhum vencimento pendente será alterado neste período. As regras também serão
                      usadas nos próximos cadastros.
                    </p>
                  )}
                </section>
              ) : null}
              <div
                className={cn(
                  "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
                  isDirty &&
                    "sticky bottom-4 z-20 rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm",
                )}
              >
                <p
                  className={
                    conflictingRuleIds.size
                      ? "text-destructive text-sm"
                      : "text-muted-foreground text-sm"
                  }
                  aria-live="polite"
                >
                  {!isDirty
                    ? "Nenhuma alteração para salvar."
                    : conflictingRuleIds.size
                      ? "Resolva os conflitos entre regras antes de revisar."
                      : previewCurrent
                        ? "Confira a prévia e salve para aplicar."
                        : "Alterações não salvas. Revise o impacto antes de aplicar."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {isDirty ? (
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={disabled}
                      onClick={discardChanges}
                    >
                      Descartar alterações
                    </Button>
                  ) : null}
                  {previewCurrent ? (
                    <Button type="submit" disabled={disabled || !isDirty}>
                      {isSubmitting ? "Salvando…" : "Salvar regras"}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      disabled={disabled || !isDirty || conflictingRuleIds.size > 0}
                      onClick={() => void calculatePreview()}
                    >
                      {preview.isPending ? "Calculando…" : "Revisar alterações"}
                    </Button>
                  )}
                </div>
              </div>
              <UnsavedChangesGuard
                busyDescription="As regras estão sendo processadas. Aguarde antes de sair."
                dirtyDescription="Você tem regras de vencimento não salvas. Continue editando ou descarte para sair."
                hasChanges={isDirty}
                isBusy={disabled}
                onDiscard={discardChanges}
              />
            </>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
