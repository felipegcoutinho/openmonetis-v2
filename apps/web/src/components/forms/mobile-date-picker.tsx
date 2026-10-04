import {
  dateOnlyToSafeInstant,
  formatDateInBrazil,
  getCurrentDateInBrazil,
  getCurrentYearInBrazil,
} from "@openmonetis/shared/date-time";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { type ComponentProps, useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileViewport } from "@/hooks/useMobileViewport";
import { cn } from "@/lib/utils";

export function MobileDatePicker(props: ComponentProps<typeof DatePicker>) {
  const mobile = useIsMobile();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useMobileViewport(element);
  const [open, setOpen] = useState(false);
  const selected = props.value ? dateOnlyToSafeInstant(props.value) : undefined;
  const [month, setMonth] = useState(selected);
  if (!mobile) return <DatePicker {...props} />;

  const today = getCurrentDateInBrazil();
  const yesterday = getCurrentDateInBrazil(
    new Date(dateOnlyToSafeInstant(today).getTime() - 86_400_000),
  );
  const allowed = (value: string) =>
    !(props.min && value < props.min) && !(props.max && value > props.max);
  function choose(value: string) {
    if (!allowed(value)) return;
    props.onChange(value);
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setMonth(selected);
        setOpen(next);
      }}
    >
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            id={props.id}
            disabled={props.disabled}
            aria-invalid={props["aria-invalid"]}
            data-slot="date-picker-trigger"
            className={cn(
              "w-full min-h-12 justify-between font-normal text-base",
              !props.value && "text-muted-foreground",
              props.className,
            )}
          />
        }
      >
        {selected
          ? formatDateInBrazil(selected, { day: "numeric", month: "long", year: "numeric" })
          : (props.placeholder ?? "Selecione uma data")}
        <CalendarDays aria-hidden="true" className="size-4" />
      </SheetTrigger>
      <SheetContent
        ref={setElement}
        side="bottom"
        showCloseButton={false}
        className="mobile-bottom-panel max-h-[90dvh] overflow-y-auto rounded-t-2xl gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pr-20">
          <SheetTitle>Selecionar data</SheetTitle>
          <SheetDescription>Escolha um dia no calendário ou use um atalho.</SheetDescription>
        </SheetHeader>
        <SheetClose
          data-mobile-back
          render={
            <Button type="button" variant="ghost" className="absolute right-3 top-3 min-h-11" />
          }
        >
          Fechar
        </SheetClose>
        <div className="flex gap-2 px-4">
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={!allowed(today)}
            onClick={() => choose(today)}
          >
            Hoje
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 flex-1"
            disabled={!allowed(yesterday)}
            onClick={() => choose(yesterday)}
          >
            Ontem
          </Button>
        </div>
        <Calendar
          className="mx-auto w-full max-w-sm [--cell-size:clamp(2rem,11vw,2.75rem)]"
          classNames={{
            week: "mt-2 grid grid-cols-7",
            weekdays: "grid grid-cols-7",
            day: "relative min-w-0 aspect-square p-0 text-center",
          }}
          captionLayout="dropdown"
          locale={ptBR}
          mode="single"
          month={month}
          onMonthChange={setMonth}
          selected={selected}
          disabled={(date) => !allowed(getCurrentDateInBrazil(date))}
          onSelect={(date) => {
            if (date) choose(getCurrentDateInBrazil(date));
          }}
          startMonth={
            props.min ? dateOnlyToSafeInstant(props.min) : new Date(Date.UTC(2000, 0, 1, 12))
          }
          endMonth={
            props.max
              ? dateOnlyToSafeInstant(props.max)
              : new Date(Date.UTC(getCurrentYearInBrazil() + 10, 11, 1, 12))
          }
        />
      </SheetContent>
    </Sheet>
  );
}
