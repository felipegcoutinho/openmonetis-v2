import {
  defaultPersonReportSchedulePeriod,
  firstPersonReportScheduleDate,
  listNextPersonReportScheduleDates,
  maximumPersonReportScheduleMonthDays,
  normalizePersonReportScheduleRule,
  type PersonReportScheduleFrequency,
  type PersonReportSchedulePeriod,
  personReportScheduleFrequencies,
  personReportSchedulePeriods,
} from "@openmonetis/domain/person-reports";
import { getCurrentDateInBrazil, getCurrentHourInBrazil } from "@openmonetis/shared/date-time";
import {
  type PersonReportScheduleOutput,
  type PersonReportScheduleStateOutput,
  UpdatePersonReportScheduleInputSchema,
} from "@openmonetis/validators/person-reports";
import { useForm } from "@tanstack/react-form";
import { Info } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useUpdatePersonReportScheduleMutation } from "../person-reports.mutations";
import {
  describePersonReportSchedule,
  formatPersonReportScheduleDate,
  getPersonReportScheduleErrorMessage,
  personReportScheduleFrequencyLabels,
  personReportSchedulePeriodDescriptions,
  personReportSchedulePeriodLabels,
  personReportWeekdayLabels,
  personReportWeekdayShortLabels,
} from "../person-reports.presentation";

type FormValues = {
  enabled: boolean;
  frequency: PersonReportScheduleFrequency;
  weekday: number;
  monthlyDay: number;
  semimonthlyDays: [number, number];
  customDays: number[];
  reportPeriod: PersonReportSchedulePeriod;
  includeSpreadsheet: boolean;
};

const monthDayOptions = Array.from({ length: 31 }, (_, index) => index + 1);
const selectedToggleClass =
  "data-pressed:border-primary data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:hover:bg-primary/90";

function toFormValues(schedule: PersonReportScheduleOutput | null): FormValues {
  const days = schedule?.monthDays ?? [];
  return {
    // Opening the rules for the first time is meant to turn the schedule on.
    enabled: schedule ? schedule.enabled : true,
    frequency: schedule?.frequency ?? "monthly",
    weekday: schedule?.weekday ?? 1,
    monthlyDay: schedule?.frequency === "monthly" ? (days[0] ?? 1) : 1,
    semimonthlyDays:
      schedule?.frequency === "semimonthly" && days.length === 2
        ? [days[0] as number, days[1] as number]
        : [1, 16],
    customDays: schedule?.frequency === "monthDays" ? days : [5, 20],
    reportPeriod: schedule?.reportPeriod ?? defaultPersonReportSchedulePeriod("monthly"),
    includeSpreadsheet: schedule?.includeSpreadsheet ?? false,
  };
}

function toRule(values: FormValues) {
  const monthDays = {
    weekly: [],
    semimonthly: values.semimonthlyDays,
    monthly: [values.monthlyDay],
    monthDays: values.customDays,
  }[values.frequency];
  return normalizePersonReportScheduleRule({
    frequency: values.frequency,
    weekday: values.frequency === "weekly" ? values.weekday : null,
    monthDays,
  });
}

export function PersonReportScheduleDialog({
  onOpenChange,
  open,
  person,
  state,
  unavailableReason,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  person: { id: string; name: string; email: string | null };
  state: PersonReportScheduleStateOutput;
  unavailableReason: string | null;
}) {
  const schedule = state.schedule;
  const active = Boolean(schedule?.enabled);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent guarded mobileLayout="sheet" className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Envio automático
            <Badge variant={active ? "default" : "outline"}>
              {active ? "Ativo" : schedule ? "Pausado" : "Desligado"}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Regras para mandar o extrato de {person.name}
            {person.email ? (
              <>
                {" "}
                para <span className="font-medium text-foreground">{person.email}</span>
              </>
            ) : null}
            , sempre às {state.sendingHour}h (horário de Brasília). Meses sem despesas não geram
            envio.
          </DialogDescription>
        </DialogHeader>
        {unavailableReason ? (
          <p className="flex items-start gap-2 rounded-md border border-dashed px-3 py-2.5 text-muted-foreground text-sm">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {unavailableReason}
          </p>
        ) : null}
        <PersonReportScheduleForm
          // Saving returns a new `updatedAt`, which restarts the form from the saved rules.
          disabled={Boolean(unavailableReason) && !active}
          key={`${person.id}:${schedule?.updatedAt ?? "new"}:${open ? "open" : "closed"}`}
          onCancel={() => onOpenChange(false)}
          onSaved={() => onOpenChange(false)}
          personId={person.id}
          schedule={schedule}
          sendingHour={state.sendingHour}
        />
      </DialogContent>
    </Dialog>
  );
}

function PersonReportScheduleForm({
  disabled,
  onCancel,
  onSaved,
  personId,
  schedule,
  sendingHour,
}: {
  disabled: boolean;
  onCancel: () => void;
  onSaved: () => void;
  personId: string;
  schedule: PersonReportScheduleOutput | null;
  sendingHour: number;
}) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const updateSchedule = useUpdatePersonReportScheduleMutation(personId);
  const form = useForm({
    defaultValues: toFormValues(schedule),
    onSubmit: async ({ value }) => {
      setError(null);
      const parsed = UpdatePersonReportScheduleInputSchema.safeParse({
        enabled: value.enabled,
        ...toRule(value),
        reportPeriod: value.reportPeriod,
        includeSpreadsheet: value.includeSpreadsheet,
      });
      if (!parsed.success) {
        setError(
          value.frequency === "monthDays"
            ? `Escolha de 1 a ${maximumPersonReportScheduleMonthDays} dias do mês.`
            : "Escolha dias diferentes para os dois envios.",
        );
        return;
      }
      try {
        await updateSchedule.mutateAsync(parsed.data);
        toast.success(parsed.data.enabled ? "Envio automático salvo" : "Envio automático pausado");
        onSaved();
      } catch (saveError) {
        setError(getPersonReportScheduleErrorMessage(saveError));
      }
    },
  });

  return (
    <form
      data-mobile-page-form
      className="grid gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Subscribe
        selector={(state) => ({ isDirty: !state.isDefaultValue, isSubmitting: state.isSubmitting })}
      >
        {(state) => <MobileFormState {...state} />}
      </form.Subscribe>
      <fieldset className="grid gap-4 disabled:opacity-60" disabled={disabled}>
        <form.Field name="enabled">
          {(field) => (
            <div className="flex items-center justify-between gap-4 rounded-lg border bg-muted/20 p-3">
              <Label className="grid cursor-pointer gap-0.5" htmlFor={`${id}-enabled`}>
                <span className="font-medium text-sm">Enviar automaticamente</span>
                <span className="font-normal text-muted-foreground text-xs">
                  Desligue para pausar sem perder as regras.
                </span>
              </Label>
              <Switch
                checked={field.state.value}
                disabled={disabled}
                id={`${id}-enabled`}
                onCheckedChange={(checked) => field.handleChange(checked)}
              />
            </div>
          )}
        </form.Field>

        <div className="grid gap-4">
          <div className="grid content-start gap-4">
            <form.Field
              name="frequency"
              listeners={{
                // A new frequency suggests its usual month; it can still be changed alongside.
                onChange: ({ value }) =>
                  form.setFieldValue("reportPeriod", defaultPersonReportSchedulePeriod(value)),
              }}
            >
              {(field) => (
                <fieldset className="grid gap-2">
                  <legend className="mb-2 font-mono text-muted-foreground text-xs">
                    Frequência
                  </legend>
                  <ToggleGroup
                    className="grid w-full grid-cols-2 sm:grid-cols-4"
                    disabled={disabled}
                    onValueChange={(value) => {
                      const next = value[0] as PersonReportScheduleFrequency | undefined;
                      if (next) field.handleChange(next);
                    }}
                    size="sm"
                    spacing={1}
                    value={[field.state.value]}
                    variant="outline"
                  >
                    {personReportScheduleFrequencies.map((frequency) => (
                      <ToggleGroupItem
                        className={`w-full px-2 ${selectedToggleClass}`}
                        key={frequency}
                        value={frequency}
                      >
                        {personReportScheduleFrequencyLabels[frequency]}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </fieldset>
              )}
            </form.Field>

            <form.Subscribe selector={(state) => state.values.frequency}>
              {(frequency) => (
                <>
                  {frequency === "weekly" ? (
                    <form.Field name="weekday">
                      {(field) => (
                        <fieldset className="grid gap-2">
                          <legend className="mb-2 font-mono text-muted-foreground text-xs">
                            Dia da semana
                          </legend>
                          <ToggleGroup
                            className="grid w-full grid-cols-7"
                            disabled={disabled}
                            onValueChange={(value) => {
                              const next = value[0];
                              if (next !== undefined) field.handleChange(Number(next));
                            }}
                            size="sm"
                            spacing={1}
                            value={[String(field.state.value)]}
                            variant="outline"
                          >
                            {personReportWeekdayLabels.map((label, weekday) => (
                              <ToggleGroupItem
                                aria-label={label}
                                className={`min-w-0 px-0 text-xs ${selectedToggleClass}`}
                                key={label}
                                value={String(weekday)}
                              >
                                {personReportWeekdayShortLabels[weekday]}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </fieldset>
                      )}
                    </form.Field>
                  ) : null}

                  {frequency === "monthly" ? (
                    <form.Field name="monthlyDay">
                      {(field) => (
                        <div className="grid gap-1.5">
                          <Label
                            className="font-mono text-muted-foreground text-xs"
                            htmlFor={`${id}-monthly-day`}
                          >
                            Dia do mês
                          </Label>
                          <MonthDaySelect
                            disabled={disabled}
                            id={`${id}-monthly-day`}
                            onChange={field.handleChange}
                            value={field.state.value}
                          />
                        </div>
                      )}
                    </form.Field>
                  ) : null}

                  {frequency === "semimonthly" ? (
                    <form.Field name="semimonthlyDays">
                      {(field) => (
                        <div className="grid grid-cols-2 gap-3">
                          {(["Primeiro envio", "Segundo envio"] as const).map((label, index) => (
                            <div className="grid gap-1.5" key={label}>
                              <Label
                                className="font-mono text-muted-foreground text-xs"
                                htmlFor={`${id}-semimonthly-${index}`}
                              >
                                {label}
                              </Label>
                              <MonthDaySelect
                                disabled={disabled}
                                id={`${id}-semimonthly-${index}`}
                                onChange={(day) => {
                                  const next: [number, number] = [...field.state.value];
                                  next[index] = day;
                                  field.handleChange(next);
                                }}
                                value={field.state.value[index] as number}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </form.Field>
                  ) : null}

                  {frequency === "monthDays" ? (
                    <form.Field name="customDays">
                      {(field) => (
                        <fieldset className="grid gap-2">
                          <legend className="mb-2 flex w-full items-center justify-between font-mono text-muted-foreground text-xs">
                            Dias do mês
                            <span className="font-sans tabular-nums">
                              {field.state.value.length}/{maximumPersonReportScheduleMonthDays}
                            </span>
                          </legend>
                          <ToggleGroup
                            className="grid w-full grid-cols-7"
                            disabled={disabled}
                            multiple
                            onValueChange={(value) =>
                              field.handleChange(
                                value
                                  .map(Number)
                                  .slice(0, maximumPersonReportScheduleMonthDays)
                                  .sort((left, right) => left - right),
                              )
                            }
                            size="sm"
                            spacing={1}
                            value={field.state.value.map(String)}
                            variant="outline"
                          >
                            {monthDayOptions.map((day) => (
                              <ToggleGroupItem
                                aria-label={`Dia ${day}`}
                                className={`min-w-0 px-0 text-xs tabular-nums ${selectedToggleClass}`}
                                disabled={
                                  field.state.value.length >=
                                    maximumPersonReportScheduleMonthDays &&
                                  !field.state.value.includes(day)
                                }
                                key={day}
                                value={String(day)}
                              >
                                {day}
                              </ToggleGroupItem>
                            ))}
                          </ToggleGroup>
                        </fieldset>
                      )}
                    </form.Field>
                  ) : null}
                </>
              )}
            </form.Subscribe>
          </div>

          <div className="grid content-start gap-4">
            <form.Field name="reportPeriod">
              {(field) => (
                <fieldset className="grid gap-2">
                  <legend className="mb-2 font-mono text-muted-foreground text-xs">
                    Mês do extrato
                  </legend>
                  <RadioGroup
                    className="grid gap-2 sm:grid-cols-2"
                    disabled={disabled}
                    onValueChange={(value) =>
                      field.handleChange(value as PersonReportSchedulePeriod)
                    }
                    value={field.state.value}
                  >
                    {personReportSchedulePeriods.map((period) => (
                      <Label
                        className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-data-checked:border-primary has-data-checked:bg-accent"
                        htmlFor={`${id}-period-${period}`}
                        key={period}
                      >
                        <RadioGroupItem
                          className="mt-0.5"
                          id={`${id}-period-${period}`}
                          value={period}
                        />
                        <span className="grid gap-0.5">
                          <span className="font-medium text-sm">
                            {personReportSchedulePeriodLabels[period]}
                          </span>
                          <span className="font-normal text-muted-foreground text-xs">
                            {personReportSchedulePeriodDescriptions[period]}
                          </span>
                        </span>
                      </Label>
                    ))}
                  </RadioGroup>
                </fieldset>
              )}
            </form.Field>

            <form.Field name="includeSpreadsheet">
              {(field) => (
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={field.state.value}
                    disabled={disabled}
                    id={`${id}-spreadsheet`}
                    onCheckedChange={(checked) => field.handleChange(checked === true)}
                  />
                  <Label className="grid cursor-pointer gap-0.5" htmlFor={`${id}-spreadsheet`}>
                    <span className="font-medium text-sm">Anexar planilha (.xlsx)</span>
                    <span className="font-normal text-muted-foreground text-xs">
                      Com os mesmos lançamentos do extrato, sem contas nem observações.
                    </span>
                  </Label>
                </div>
              )}
            </form.Field>
          </div>
        </div>
      </fieldset>

      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}

      <div className="rounded-lg bg-muted/40 p-3">
        <form.Subscribe selector={(state) => state.values}>
          {(values) => <SchedulePreview sendingHour={sendingHour} values={values} />}
        </form.Subscribe>
      </div>

      <DialogFooter>
        <Button data-mobile-cancel onClick={onCancel} type="button" variant="outline">
          Cancelar
        </Button>
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button disabled={disabled || isSubmitting} type="submit">
              {isSubmitting ? "Salvando…" : "Salvar regras"}
            </Button>
          )}
        </form.Subscribe>
      </DialogFooter>
    </form>
  );
}

function MonthDaySelect({
  disabled,
  id,
  onChange,
  value,
}: {
  disabled: boolean;
  id: string;
  onChange: (day: number) => void;
  value: number;
}) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(next) => next && onChange(Number(next))}
      value={String(value)}
    >
      <SelectTrigger className="w-full" id={id}>
        <SelectValue>Dia {value}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {monthDayOptions.map((day) => (
          <SelectItem key={day} value={String(day)}>
            Dia {day}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SchedulePreview({ sendingHour, values }: { sendingHour: number; values: FormValues }) {
  if (!values.enabled) {
    return (
      <p className="text-muted-foreground text-sm">
        Nenhum envio programado. Ligue o envio automático para usar estas regras.
      </p>
    );
  }
  const rule = toRule(values);
  const now = new Date();
  const dates =
    rule.frequency === "weekly" || rule.monthDays.length
      ? listNextPersonReportScheduleDates(
          rule,
          firstPersonReportScheduleDate(getCurrentDateInBrazil(now), getCurrentHourInBrazil(now)),
          3,
        )
      : [];

  return (
    <div aria-live="polite" className="grid min-w-0 gap-1.5">
      <p className="font-medium text-sm">
        {describePersonReportSchedule(rule)}, às {sendingHour}h ·{" "}
        <span className="font-normal text-muted-foreground">
          {personReportSchedulePeriodLabels[values.reportPeriod].toLocaleLowerCase("pt-BR")}
        </span>
      </p>
      {dates.length ? (
        <ul aria-label="Próximos envios" className="flex flex-wrap items-center gap-1.5">
          {dates.map((date) => (
            <li key={date}>
              <Badge className="font-mono tabular-nums" variant="outline">
                {formatPersonReportScheduleDate(date)}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {rule.monthDays.some((day) => day > 28) ? (
        <p className="text-muted-foreground text-xs">
          Em meses mais curtos, o envio sai no último dia do mês.
        </p>
      ) : null}
    </div>
  );
}
