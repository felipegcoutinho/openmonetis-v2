import { recurringHolidayMaximumCount } from "@openmonetis/domain/business-calendars";
import { CalendarDays, X } from "lucide-react";
import { useId, useState } from "react";
import { MobileDatePicker } from "@/components/forms/mobile-date-picker";
import { SettingsSection } from "@/components/settings-panel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { formatDueDate, formatRecurringHoliday } from "../due-date-rules.presentation";
import type { useDueDateRulesForm } from "../useDueDateRulesForm";
import { DueDateRulesHolidays } from "./due-date-rules-holidays";
export function DueDateRulesCalendar({
  form,
  disabled,
}: {
  form: ReturnType<typeof useDueDateRulesForm>["form"];
  disabled: boolean;
}) {
  const id = useId();
  const [holiday, setHoliday] = useState("");
  const [repeatYearly, setRepeatYearly] = useState(false);
  return (
    <SettingsSection
      icon={CalendarDays}
      title="Calendário"
      description="Dias úteis: segunda a sexta, exceto os feriados considerados."
    >
      <div className="grid gap-4">
        <form.Field name="calendar.includeNationalHolidays">
          {(field) => (
            <div className="grid min-w-0 gap-3">
              <Label htmlFor={`${id}-national`}>
                <Checkbox
                  id={`${id}-national`}
                  checked={field.state.value}
                  disabled={disabled}
                  onCheckedChange={(value) => field.handleChange(value === true)}
                />
                Considerar feriados nacionais
              </Label>
              <DueDateRulesHolidays included={field.state.value} />
            </div>
          )}
        </form.Field>
        <form.Subscribe
          selector={(state) => ({
            holidays: state.values.calendar.holidays,
            recurringHolidays: state.values.calendar.recurringHolidays,
          })}
        >
          {({ holidays, recurringHolidays }) => {
            const monthDay = holiday.slice(5);
            const alreadyAdded = repeatYearly
              ? recurringHolidays.includes(monthDay)
              : holidays.includes(holiday);
            const limitReached = repeatYearly
              ? recurringHolidays.length >= recurringHolidayMaximumCount
              : holidays.length >= 366;
            return (
              <div className="grid gap-3">
                <Label htmlFor={`${id}-holiday`}>Feriados adicionais</Label>
                <p className="-mt-1 text-muted-foreground text-xs">
                  Inclua feriados estaduais e municipais. Os que se repetem valem para todos os
                  anos.
                </p>
                <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <MobileDatePicker
                    className="min-w-0 [&>span]:truncate"
                    id={`${id}-holiday`}
                    value={holiday}
                    onChange={setHoliday}
                    disabled={disabled}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={disabled || !holiday || alreadyAdded || limitReached}
                    onClick={() => {
                      if (repeatYearly)
                        form.setFieldValue(
                          "calendar.recurringHolidays",
                          [...recurringHolidays, monthDay].sort(),
                        );
                      else form.setFieldValue("calendar.holidays", [...holidays, holiday].sort());
                      setHoliday("");
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
                <Label htmlFor={`${id}-repeat`}>
                  <Checkbox
                    id={`${id}-repeat`}
                    checked={repeatYearly}
                    disabled={disabled}
                    onCheckedChange={(value) => setRepeatYearly(value === true)}
                  />
                  Repetir todo ano
                </Label>
                {recurringHolidays.length ? (
                  <HolidayChips
                    disabled={disabled}
                    label="Todo ano"
                    items={recurringHolidays.map((value) => ({
                      value,
                      text: formatRecurringHoliday(value),
                    }))}
                    onRemove={(value) =>
                      form.setFieldValue(
                        "calendar.recurringHolidays",
                        recurringHolidays.filter((item) => item !== value),
                      )
                    }
                  />
                ) : null}
                {holidays.length ? (
                  <HolidayChips
                    disabled={disabled}
                    label="Somente na data"
                    items={holidays.map((value) => ({ value, text: formatDueDate(value) }))}
                    onRemove={(value) =>
                      form.setFieldValue(
                        "calendar.holidays",
                        holidays.filter((item) => item !== value),
                      )
                    }
                  />
                ) : null}
              </div>
            );
          }}
        </form.Subscribe>
      </div>
    </SettingsSection>
  );
}

function HolidayChips({
  label,
  items,
  disabled,
  onRemove,
}: {
  label: string;
  items: Array<{ value: string; text: string }>;
  disabled: boolean;
  onRemove: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <p className="font-medium text-muted-foreground text-xs">{label}</p>
      <div className="flex min-w-0 flex-wrap gap-2">
        {items.map((item) => (
          <Button
            key={item.value}
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled}
            onClick={() => onRemove(item.value)}
            aria-label={`Remover feriado ${item.text}`}
          >
            {item.text}
            <X aria-hidden="true" className="size-3" />
          </Button>
        ))}
      </div>
    </div>
  );
}
