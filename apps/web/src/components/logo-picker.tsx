import { Image } from "@unpic/react";
import { Check, ChevronsUpDown, Landmark, Search, X } from "lucide-react";
import { type KeyboardEvent, useMemo, useRef, useState } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";
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

const OPTION_SELECTOR = "[data-logo-option]";
const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

const tileClassName =
  "relative flex min-h-24 flex-col items-center justify-center gap-1.5 rounded-md p-2 text-center text-xs border border-input bg-popover shadow-xs outline-none transition-[color,background-color,border-color,box-shadow,scale] duration-150 hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] aria-pressed:border-brand aria-pressed:bg-accent aria-pressed:font-medium";

/** Accent- and case-insensitive, so "itau" finds "Itaú". */
function normalizeSearch(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

// Stable identity: runs only when the selected option mounts, not on every render.
function revealSelectedOption(node: HTMLButtonElement | null) {
  node?.scrollIntoView({ block: "nearest" });
}

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
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find((option) => option.src === value)?.label ?? "";
  const query = normalizeSearch(search);

  const visibleOptions = useMemo(() => {
    if (!query) return options;
    return options.filter((option) => normalizeSearch(option.label).includes(query));
  }, [options, query]);

  const featuredOptions = visibleOptions.filter((option) => option.featured);
  const remainingOptions = visibleOptions.filter((option) => !option.featured);

  function changeOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setSearch("");
  }

  function selectLogo(option: string | null) {
    onChange(option);
    changeOpen(false);
  }

  function clearSearch() {
    setSearch("");
    searchRef.current?.focus();
  }

  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      listRef.current?.querySelector<HTMLButtonElement>(OPTION_SELECTOR)?.focus();
    } else if (event.key === "Enter" && query && visibleOptions.length > 0) {
      event.preventDefault();
      selectLogo(visibleOptions[0].src);
    }
  }

  function handleListKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!ARROW_KEYS.includes(event.key)) return;
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(OPTION_SELECTOR),
    );
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    if (index === -1) return;
    event.preventDefault();

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      items[index + (event.key === "ArrowRight" ? 1 : -1)]?.focus();
      return;
    }

    // Vertical moves follow the rendered grid, whatever the column count is.
    const down = event.key === "ArrowDown";
    const current = items[index].getBoundingClientRect();
    const beyond = items
      .map((item) => ({ item, rect: item.getBoundingClientRect() }))
      .filter(({ rect }) => (down ? rect.top > current.top + 1 : rect.top < current.top - 1));
    if (beyond.length === 0) {
      if (!down) searchRef.current?.focus();
      return;
    }
    const rowTop = down
      ? Math.min(...beyond.map(({ rect }) => rect.top))
      : Math.max(...beyond.map(({ rect }) => rect.top));
    const row = beyond.filter(({ rect }) => Math.abs(rect.top - rowTop) < 1);
    const target = row.reduce((best, entry) =>
      Math.abs(entry.rect.left - current.left) < Math.abs(best.rect.left - current.left)
        ? entry
        : best,
    );
    target.item.focus();
  }

  return (
    <>
      <Button
        aria-haspopup="dialog"
        className="h-auto w-full justify-start gap-3 border-input bg-popover px-2.5 py-2 text-left shadow-xs"
        disabled={disabled}
        onClick={() => setOpen(true)}
        type="button"
        variant="outline"
      >
        {value ? (
          <Image
            alt=""
            className="size-10 shrink-0 rounded-full object-contain"
            height={40}
            layout="fixed"
            src={value}
            width={40}
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed border-input text-muted-foreground">
            <Landmark aria-hidden="true" className="size-4" />
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-muted-foreground text-xs">{label}</span>
          <span
            className={cn(
              "block truncate text-sm",
              selectedLabel ? "font-medium" : "font-normal text-muted-foreground",
            )}
          >
            {selectedLabel || emptyLabel}
          </span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Button>

      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent mobileLayout="sheet" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              autoComplete="off"
              autoFocus={!mobile}
              aria-label={searchPlaceholder}
              className="px-9"
              enterKeyHint="search"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={searchPlaceholder}
              ref={searchRef}
              spellCheck={false}
              value={search}
            />
            {search ? (
              <Button
                aria-label="Limpar busca"
                className="absolute top-1/2 right-1 size-7 -translate-y-1/2 text-muted-foreground"
                onClick={clearSearch}
                size="icon"
                type="button"
                variant="ghost"
              >
                <X aria-hidden="true" className="size-4" />
              </Button>
            ) : null}
          </div>
          {/* Fixed height: the dialog must not resize while the results change. */}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: delegated arrow-key navigation between the option buttons. */}
          <div
            data-mobile-form-body
            className="flex h-[min(26rem,55dvh)] flex-col gap-5 overflow-y-auto p-1"
            onKeyDown={handleListKeyDown}
            ref={listRef}
          >
            {query ? (
              visibleOptions.length > 0 ? (
                <LogoGrid
                  heading={
                    visibleOptions.length === 1
                      ? "1 resultado"
                      : `${visibleOptions.length} resultados`
                  }
                  onSelect={selectLogo}
                  options={visibleOptions}
                  value={value}
                />
              ) : (
                <div className="grid flex-1 place-content-center justify-items-center gap-3 text-center">
                  <p aria-live="polite" className="text-muted-foreground text-sm">
                    Nenhuma instituição encontrada para “{search.trim()}”.
                  </p>
                  <Button onClick={clearSearch} size="sm" type="button" variant="outline">
                    Limpar busca
                  </Button>
                </div>
              )
            ) : (
              <>
                {featuredOptions.length > 0 || allowEmpty ? (
                  <LogoGrid
                    emptyOptionLabel={allowEmpty ? emptyOptionLabel : undefined}
                    heading="Mais usadas"
                    onSelect={selectLogo}
                    options={featuredOptions}
                    value={value}
                  />
                ) : null}
                {remainingOptions.length > 0 ? (
                  <LogoGrid
                    heading="Todas as instituições"
                    onSelect={selectLogo}
                    options={remainingOptions}
                    value={value}
                  />
                ) : null}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

type LogoGridProps = {
  /** When set, renders the "no logo" tile as the first option of the grid. */
  emptyOptionLabel?: string;
  heading: string;
  options: readonly LogoCatalogItem[];
  value?: string | null;
  onSelect: (option: string | null) => void;
};

function LogoGrid({ emptyOptionLabel, heading, options, value, onSelect }: LogoGridProps) {
  return (
    <section className="grid shrink-0 gap-2">
      <h3 className="font-medium text-muted-foreground text-xs">{heading}</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {emptyOptionLabel ? (
          <button
            aria-pressed={value == null}
            className={tileClassName}
            data-logo-option
            onClick={() => onSelect(null)}
            type="button"
          >
            {value == null ? <SelectedIndicator /> : null}
            <span className="grid size-11 place-items-center rounded-full border border-dashed border-input text-muted-foreground">
              <Landmark aria-hidden="true" className="size-4" />
            </span>
            <span className="line-clamp-2 leading-tight">{emptyOptionLabel}</span>
          </button>
        ) : null}
        {options.map((option) => {
          const selected = option.src === value;

          return (
            <button
              aria-label={`Selecionar ${option.label}`}
              aria-pressed={selected}
              className={tileClassName}
              data-logo-option
              key={option.src}
              onClick={() => onSelect(option.src)}
              ref={selected ? revealSelectedOption : undefined}
              type="button"
            >
              {selected ? <SelectedIndicator /> : null}
              <Image
                alt=""
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
    <span className="absolute top-1.5 right-1.5 grid size-4 place-items-center rounded-full bg-brand text-brand-foreground">
      <Check aria-hidden="true" className="size-3" />
    </span>
  );
}
