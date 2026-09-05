import { Image } from "@unpic/react";
import { Check, ImageOff, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { LogoCatalogItem } from "@/lib/logo-catalog";
import { cn } from "@/lib/utils";

type LogoPickerProps = {
  options: readonly LogoCatalogItem[];
  value?: string | null;
  label: string;
  emptyLabel?: string;
  dialogTitle?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  onChange: (option: string | null) => void;
};

export function LogoPicker({
  options,
  value,
  label,
  emptyLabel = "Selecionar instituição",
  dialogTitle = "Selecionar instituição",
  disabled = false,
  searchPlaceholder = "Buscar instituição",
  allowEmpty = false,
  emptyOptionLabel = "Sem instituição",
  onChange,
}: LogoPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selectedLabel = options.find((option) => option.src === value)?.label ?? "";

  const visibleOptions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");

    if (!query) {
      return options;
    }

    return options.filter((option) => option.label.toLocaleLowerCase("pt-BR").includes(query));
  }, [options, search]);

  const featuredVisibleOptions = visibleOptions.filter((option) => option.featured);
  const remainingVisibleOptions = visibleOptions.filter((option) => !option.featured);

  function selectLogo(option: string | null) {
    onChange(option);
    setOpen(false);
    setSearch("");
  }

  return (
    <>
      <Button
        className="h-auto w-full justify-start border-input bg-popover px-2.5 py-2 text-left shadow-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        {value ? (
          <Image
            alt=""
            className="size-11 shrink-0 rounded-full object-contain"
            height={44}
            layout="fixed"
            src={value}
            width={44}
          />
        ) : (
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-4" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-medium text-sm">{label}</span>
          <span className="block truncate text-muted-foreground text-xs">
            {selectedLabel || emptyLabel}
          </span>
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoFocus
              aria-label={searchPlaceholder}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
              value={search}
            />
          </div>
          <div className="grid max-h-80 gap-5 overflow-y-auto pr-1">
            {(featuredVisibleOptions.length > 0 || allowEmpty) && !search.trim() ? (
              <LogoGrid
                allowEmpty={allowEmpty}
                emptyOptionLabel={emptyOptionLabel}
                heading="Mais usadas"
                onSelect={selectLogo}
                options={featuredVisibleOptions}
                value={value}
              />
            ) : null}

            {(search.trim() ? visibleOptions.length > 0 : remainingVisibleOptions.length > 0) ? (
              <LogoGrid
                heading={search.trim() ? "Resultados" : "Todas as instituições"}
                onSelect={selectLogo}
                options={search.trim() ? visibleOptions : remainingVisibleOptions}
                value={value}
              />
            ) : null}

            {visibleOptions.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground text-sm">
                Nenhuma instituição encontrada.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type LogoGridProps = {
  allowEmpty?: boolean;
  emptyOptionLabel?: string;
  heading: string;
  options: readonly LogoCatalogItem[];
  value?: string | null;
  onSelect: (option: string | null) => void;
};

function LogoGrid({
  allowEmpty = false,
  emptyOptionLabel = "Sem instituição",
  heading,
  options,
  value,
  onSelect,
}: LogoGridProps) {
  return (
    <section className="grid gap-2">
      <h3 className="text-muted-foreground text-xs font-medium">{heading}</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {allowEmpty ? (
          <button
            aria-label={emptyOptionLabel}
            className={cn(
              "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-input bg-popover p-2 text-center text-xs shadow-xs transition-[color,box-shadow] hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
              value === null && "bg-accent text-brand-strong",
            )}
            onClick={() => onSelect(null)}
            type="button"
          >
            {value === null ? <SelectedIndicator /> : null}
            <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
              <ImageOff aria-hidden="true" className="size-5" />
            </span>
            <span className="line-clamp-2 leading-tight">{emptyOptionLabel}</span>
          </button>
        ) : null}
        {options.map((option) => {
          const selected = option.src === value;

          return (
            <button
              aria-label={`Selecionar ${option.label}`}
              className={cn(
                "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-md border border-input bg-popover p-2 text-center text-xs shadow-xs transition-[color,box-shadow] hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                selected && "bg-accent text-brand-strong",
              )}
              key={option.src}
              onClick={() => onSelect(option.src)}
              type="button"
            >
              {selected ? <SelectedIndicator /> : null}
              <Image
                alt={option.label}
                className="size-11 rounded-full object-contain"
                height={44}
                layout="fixed"
                src={option.src}
                width={44}
              />
              <span className="line-clamp-2 leading-tight">{option.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SelectedIndicator() {
  return (
    <span className="absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-sm bg-brand text-brand-foreground">
      <Check aria-hidden="true" className="size-3" />
    </span>
  );
}
