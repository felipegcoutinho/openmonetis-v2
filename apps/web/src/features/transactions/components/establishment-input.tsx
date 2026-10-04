import { LoaderCircle, Search } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import {
  MobilePicker as Popover,
  MobilePickerContent as PopoverContent,
  MobilePickerTrigger as PopoverTrigger,
} from "@/components/forms/mobile-picker";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";

type EstablishmentInputProps = {
  value: string;
  establishments: string[];
  disabled?: boolean;
  invalid?: boolean;
  loading?: boolean;
  maxLength?: number;
  placeholder?: string;
  onBlur: () => void;
  onChange: (value: string) => void;
};

export function EstablishmentInput({
  value,
  establishments,
  disabled = false,
  invalid = false,
  loading = false,
  maxLength,
  placeholder,
  onBlur,
  onChange,
}: EstablishmentInputProps) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [contentWidth, setContentWidth] = useState<number>();
  const containerRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
  const visibleEstablishments = useMemo(
    () =>
      normalizedQuery
        ? establishments.filter((name) => name.toLocaleLowerCase("pt-BR").includes(normalizedQuery))
        : establishments,
    [establishments, normalizedQuery],
  );

  function selectEstablishment(name: string) {
    onChange(name);
    setQuery("");
    setOpen(false);
  }

  function openEstablishments() {
    if (!establishments.length) return;

    const container = containerRef.current;
    if (container) setContentWidth(container.offsetWidth);
    setOpen(true);
  }

  return (
    <Popover
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen && establishments.length > 0);
        const container = containerRef.current;
        if (nextOpen && container) setContentWidth(container.offsetWidth);
        if (!nextOpen) setQuery("");
      }}
      open={open}
    >
      <div className="relative" ref={containerRef}>
        <Input
          aria-autocomplete={mobile ? undefined : "list"}
          aria-expanded={mobile ? undefined : open}
          aria-invalid={invalid}
          autoComplete="off"
          className={establishments.length || loading ? "pr-9 text-left" : "text-left"}
          disabled={disabled}
          maxLength={maxLength}
          onBlur={onBlur}
          onChange={(event) => {
            const nextValue = event.target.value;
            onChange(nextValue);
            setQuery(nextValue);
          }}
          onClick={mobile ? undefined : openEstablishments}
          placeholder={placeholder}
          required
          role={mobile ? undefined : "combobox"}
          value={value}
        />
        {loading ? (
          <LoaderCircle
            aria-label="Carregando estabelecimentos recentes"
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        ) : establishments.length && mobile ? (
          <PopoverTrigger
            aria-label="Escolher uma descrição recente"
            disabled={disabled}
            render={
              <Button
                className="absolute top-1/2 right-0 size-11 -translate-y-1/2"
                type="button"
                variant="ghost"
              />
            }
          >
            <Search aria-hidden="true" className="size-4" />
          </PopoverTrigger>
        ) : establishments.length ? (
          <PopoverTrigger
            render={
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground"
                tabIndex={-1}
              />
            }
          >
            <Search aria-hidden="true" className="size-4" />
          </PopoverTrigger>
        ) : null}
      </div>

      <PopoverContent
        title="Descrições recentes"
        align="end"
        className="w-[var(--anchor-width)] gap-0 p-0"
        finalFocus={false}
        initialFocus={false}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          setOpen(false);
        }}
        style={contentWidth ? { width: contentWidth } : undefined}
      >
        {mobile ? (
          <Input
            aria-label="Buscar descrições recentes"
            className="mb-3"
            placeholder="Buscar descrição"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        ) : null}
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>Nenhum estabelecimento encontrado.</CommandEmpty>
            <CommandGroup className="text-left" heading="Estabelecimentos dos últimos 2 meses">
              {visibleEstablishments.map((name) => (
                <CommandItem
                  className="cursor-pointer justify-start text-left"
                  data-checked={value === name}
                  key={name}
                  onSelect={() => selectEstablishment(name)}
                  value={name}
                >
                  <span className="min-w-0 flex-1 truncate text-left">{name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
