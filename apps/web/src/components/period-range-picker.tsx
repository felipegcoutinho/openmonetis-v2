import {
  formatDateInBrazil,
  getCurrentPeriodInBrazil,
  periodToSafeInstant,
} from "@openmonetis/shared/date-time";
import { useForm } from "@tanstack/react-form";
import { useHydrated } from "@tanstack/react-router";
import { CalendarRange, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useId, useState } from "react";
import type { z } from "zod";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type PeriodRangeValue = { startPeriod: string; endPeriod: string };

type PeriodRangePickerProps = {
  value: PeriodRangeValue;
  onChange: (value: PeriodRangeValue) => void;
  schema: z.ZodType<PeriodRangeValue, PeriodRangeValue>;
  maxMonths: number;
};

const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function formatPeriod(period: string) {
  return formatDateInBrazil(periodToSafeInstant(period), {
    month: "short",
    year: "numeric",
  })
    .replace(" de ", "/")
    .replaceAll(".", "");
}

function toPeriod(year: number, monthIndex: number) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

function periodToMonthNumber(period: string) {
  const [year = 0, month = 1] = period.split("-").map(Number);
  return year * 12 + month - 1;
}

function countMonths(range: PeriodRangeValue) {
  return periodToMonthNumber(range.endPeriod) - periodToMonthNumber(range.startPeriod) + 1;
}

function shiftPeriod(period: string, months: number) {
  const total = periodToMonthNumber(period) + months;
  return toPeriod(Math.floor(total / 12), total % 12);
}

function orderedRange(first: string, second: string): PeriodRangeValue {
  return first <= second
    ? { startPeriod: first, endPeriod: second }
    : { startPeriod: second, endPeriod: first };
}

function sameRange(a: PeriodRangeValue, b: PeriodRangeValue) {
  return a.startPeriod === b.startPeriod && a.endPeriod === b.endPeriod;
}

function buildPresets(maxMonths: number) {
  const current = getCurrentPeriodInBrazil();
  const currentYear = Number(current.slice(0, 4));
  return [
    { label: "3 meses", range: { startPeriod: shiftPeriod(current, -2), endPeriod: current } },
    { label: "6 meses", range: { startPeriod: shiftPeriod(current, -5), endPeriod: current } },
    { label: "12 meses", range: { startPeriod: shiftPeriod(current, -11), endPeriod: current } },
    { label: "Este ano", range: { startPeriod: toPeriod(currentYear, 0), endPeriod: current } },
    {
      label: "Ano passado",
      range: {
        startPeriod: toPeriod(currentYear - 1, 0),
        endPeriod: toPeriod(currentYear - 1, 11),
      },
    },
  ].filter((preset) => countMonths(preset.range) <= maxMonths);
}

export function PeriodRangePicker(props: PeriodRangePickerProps) {
  const [open, setOpen] = useState(false);
  const hydrated = useHydrated();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={!hydrated}
        render={<Button type="button" variant="outline" className="max-w-full" />}
      >
        <CalendarRange aria-hidden="true" className="size-4 text-muted-foreground" />
        <span className="font-normal text-muted-foreground">Período:</span>
        <span className="tabular-nums">
          {formatPeriod(props.value.startPeriod)} – {formatPeriod(props.value.endPeriod)}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        aria-label="Escolher período"
        className="w-64 max-w-[calc(100vw-2rem)] gap-0"
      >
        {open ? (
          <PeriodRangeForm
            key={`${props.value.startPeriod}:${props.value.endPeriod}`}
            {...props}
            onClose={() => setOpen(false)}
          />
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function PeriodRangeForm({
  value,
  onChange,
  schema,
  maxMonths,
  onClose,
}: PeriodRangePickerProps & {
  onClose: () => void;
}) {
  const id = useId();
  const [visibleYear, setVisibleYear] = useState(Number(value.endPeriod.slice(0, 4)));
  // Início já escolhido, aguardando o fim do intervalo.
  const [anchor, setAnchor] = useState<string | null>(null);
  // Mês sob o ponteiro ou foco, usado só para pré-visualizar o intervalo.
  const [preview, setPreview] = useState<string | null>(null);
  const presets = buildPresets(maxMonths);
  const currentPeriod = getCurrentPeriodInBrazil();
  const form = useForm({
    defaultValues: { startPeriod: value.startPeriod, endPeriod: value.endPeriod },
    validators: { onChange: schema, onSubmit: schema },
    onSubmit: ({ value: range }) => {
      onChange(range);
      onClose();
    },
  });

  function setRange(range: PeriodRangeValue) {
    form.setFieldValue("startPeriod", range.startPeriod);
    form.setFieldValue("endPeriod", range.endPeriod);
  }

  function selectPreset(range: PeriodRangeValue) {
    setAnchor(null);
    setRange(range);
    setVisibleYear(Number(range.endPeriod.slice(0, 4)));
  }

  function selectMonth(period: string) {
    if (anchor === null) {
      setAnchor(period);
      setRange({ startPeriod: period, endPeriod: period });
      return;
    }
    setAnchor(null);
    setRange(orderedRange(anchor, period));
  }

  return (
    <form
      className="grid gap-3"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <p id={`${id}-hint`} className="sr-only">
        Clique no primeiro mês e depois no último, com até {maxMonths} meses.
      </p>

      {presets.length > 0 ? (
        <form.Subscribe selector={(state) => state.values}>
          {(range) => (
            <div className="-mx-1.5 flex flex-wrap gap-x-0.5 gap-y-1">
              {presets.map((preset) => {
                const active = anchor === null && sameRange(range, preset.range);
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={active}
                    onClick={() => selectPreset(preset.range)}
                    className="h-6 rounded-md px-1.5 text-muted-foreground text-xs outline-none transition-colors duration-150 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring aria-pressed:bg-foreground/10 aria-pressed:text-foreground"
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          )}
        </form.Subscribe>
      ) : null}

      <form.Subscribe selector={(state) => state.values}>
        {(range) => {
          // Enquanto o fim não foi escolhido, a faixa acompanha o ponteiro.
          const shown = anchor === null ? range : orderedRange(anchor, preview ?? anchor);
          const isSingle = shown.startPeriod === shown.endPeriod;
          return (
            <div className="grid gap-1.5">
              <div className="-mx-1.5 flex items-center justify-between">
                <Button
                  aria-label="Ano anterior"
                  onClick={() => setVisibleYear((year) => year - 1)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="font-medium text-sm tabular-nums">{visibleYear}</span>
                <Button
                  aria-label="Próximo ano"
                  onClick={() => setVisibleYear((year) => year + 1)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
              <div
                className="grid grid-cols-4 gap-y-0.5"
                onPointerLeave={() => setPreview(null)}
                aria-describedby={`${id}-hint`}
              >
                {MONTH_LABELS.map((label, index) => {
                  const period = toPeriod(visibleYear, index);
                  const isStart = period === shown.startPeriod;
                  const isEnd = period === shown.endPeriod;
                  const isEdge = isStart || isEnd;
                  const inBand = period >= shown.startPeriod && period <= shown.endPeriod;
                  const column = index % 4;
                  const exceedsLimit =
                    anchor !== null &&
                    Math.abs(periodToMonthNumber(period) - periodToMonthNumber(anchor)) + 1 >
                      maxMonths;
                  return (
                    <div
                      key={period}
                      className={cn(
                        inBand && !isSingle && "bg-primary/15",
                        inBand && (isStart || column === 0) && "rounded-l-md",
                        inBand && (isEnd || column === 3) && "rounded-r-md",
                      )}
                    >
                      <button
                        type="button"
                        aria-pressed={period === range.startPeriod || period === range.endPeriod}
                        aria-label={formatPeriod(period)}
                        disabled={exceedsLimit}
                        onClick={() => selectMonth(period)}
                        onPointerEnter={() => setPreview(period)}
                        onFocus={() => setPreview(period)}
                        className={cn(
                          "relative flex h-8 w-full items-center justify-center rounded-md text-sm outline-none transition-[background-color,color,scale] duration-150 focus-visible:ring-3 focus-visible:ring-ring motion-safe:active:not-disabled:scale-[0.96] disabled:text-muted-foreground/35",
                          isEdge
                            ? "bg-primary font-medium text-primary-foreground"
                            : "hover:not-disabled:bg-foreground/8",
                          !isEdge && !inBand && "text-muted-foreground",
                        )}
                      >
                        {label}
                        {period === currentPeriod ? (
                          <span
                            aria-hidden="true"
                            className={cn(
                              "absolute bottom-0.5 size-0.75 rounded-full",
                              isEdge ? "bg-primary-foreground" : "bg-primary",
                            )}
                          />
                        ) : null}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }}
      </form.Subscribe>

      <form.Subscribe selector={(state) => [state.values, state.isValid, state.canSubmit] as const}>
        {([range, isValid, canSubmit]) => {
          const months = countMonths(range);
          return (
            <div className="flex items-center justify-between gap-3">
              <p
                id={`${id}-error`}
                role="status"
                className={cn(
                  "min-w-0 truncate text-xs tabular-nums",
                  isValid ? "text-muted-foreground" : "text-destructive",
                )}
              >
                {anchor !== null ? (
                  <span>Escolha o mês final</span>
                ) : isValid ? (
                  <span>
                    {months} {months === 1 ? "mês" : "meses"}
                  </span>
                ) : (
                  <span>Máximo de {maxMonths} meses.</span>
                )}
              </p>
              <Button type="submit" size="sm" disabled={!canSubmit || anchor !== null}>
                Aplicar
              </Button>
            </div>
          );
        }}
      </form.Subscribe>
    </form>
  );
}
