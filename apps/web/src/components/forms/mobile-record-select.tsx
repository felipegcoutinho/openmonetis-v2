import { Check, ChevronDown, Search } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

type RecordOption = { value: string; label: string; content?: ReactNode };

/** Search is presentation-only; records and ownership still come from the API. */
export function MobileRecordSelect({
  children,
  disabled,
  invalid,
  onValueChange,
  options,
  title,
  value,
  createOption,
}: {
  children: ReactNode;
  disabled?: boolean;
  invalid?: boolean;
  onValueChange: (value: string | null) => void;
  options: RecordOption[];
  title: string;
  value: string;
  createOption?: RecordOption;
}) {
  const mobile = useIsMobile();
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  useMobileViewport(element);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchId = useId();
  if (!mobile)
    return (
      <Select disabled={disabled} onValueChange={onValueChange} value={value}>
        {children}
      </Select>
    );

  const normalize = (text: string) =>
    text
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLocaleLowerCase("pt-BR");
  const matches = options.filter((option) =>
    normalize(option.label).includes(normalize(search.trim())),
  );
  const selected = options.find((option) => option.value === value);
  function choose(next: string) {
    setOpen(false);
    onValueChange(next);
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (next) setSearch("");
        setOpen(next);
      }}
    >
      <SheetTrigger
        render={
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            aria-invalid={invalid}
            aria-label={`${title}: ${selected?.label ?? "Selecione"}`}
            className="w-full min-h-12 justify-between text-base font-normal"
          />
        }
      >
        <span className="min-w-0 truncate">
          {selected?.content ?? selected?.label ?? "Selecione"}
        </span>
        <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
      </SheetTrigger>
      <SheetContent
        ref={setElement}
        side="bottom"
        showCloseButton={false}
        className="mobile-bottom-panel mobile-record-panel h-[min(80dvh,36rem)] gap-3 rounded-t-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="pr-20 pb-0">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Busque e toque para selecionar.</SheetDescription>
        </SheetHeader>
        <SheetClose
          data-mobile-back
          render={
            <Button type="button" variant="ghost" className="absolute right-3 top-3 min-h-11" />
          }
        >
          Fechar
        </SheetClose>
        <div className="relative mx-4">
          <Search
            aria-hidden="true"
            className="absolute left-3 top-4 size-4 text-muted-foreground"
          />
          <label className="sr-only" htmlFor={searchId}>
            Buscar em {title.toLocaleLowerCase("pt-BR")}
          </label>
          <Input
            id={searchId}
            className="min-h-12 pl-10 text-base"
            placeholder="Buscar…"
            autoComplete="off"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <fieldset
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2"
          aria-label={title}
        >
          {matches.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant="ghost"
              aria-pressed={option.value === value}
              className="h-auto min-h-12 w-full justify-between px-3 py-3 text-left text-base font-normal whitespace-normal"
              onClick={() => choose(option.value)}
            >
              <span className="min-w-0">{option.content ?? option.label}</span>
              {option.value === value ? (
                <Check aria-hidden="true" className="size-4 shrink-0" />
              ) : null}
            </Button>
          ))}
          {!matches.length ? (
            <p role="status" className="px-3 py-6 text-sm text-muted-foreground">
              Nenhum resultado encontrado.
            </p>
          ) : null}
        </fieldset>
        {createOption ? (
          <Button
            type="button"
            variant="outline"
            className="mx-4 min-h-12"
            onClick={() => choose(createOption.value)}
          >
            {createOption.label}
          </Button>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
