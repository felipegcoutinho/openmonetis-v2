import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MobileFormDialog as Dialog } from "@/components/forms/mobile-form-dialog";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/useIsMobile";
import { cn } from "@/lib/utils";
import { CategoryIcon, categoryIconOptions } from "../category-icons";

export function CategoryIconPicker({
  id,
  onChange,
  value,
}: {
  id: string;
  onChange: (icon: string) => void;
  value: string;
}) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = categoryIconOptions.find((option) => option.value === value);
  const visible = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return query
      ? categoryIconOptions.filter((option) =>
          option.label.toLocaleLowerCase("pt-BR").includes(query),
        )
      : categoryIconOptions;
  }, [search]);
  return (
    <>
      <button
        className="flex min-h-9 w-full items-center gap-2 rounded-md border border-input bg-popover px-2.5 py-1.5 text-left shadow-xs transition-[color,box-shadow] hover:border-brand-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        id={id}
        onClick={() => setOpen(true)}
        type="button"
      >
        <span className="grid size-8 place-items-center rounded-full bg-muted/30 text-brand-strong">
          <CategoryIcon name={value} />
        </span>
        <span className="grid">
          <span className="text-sm font-medium">{selected?.label ?? "Selecionar ícone"}</span>
          <span className="text-muted-foreground text-xs">Clique para trocar o ícone</span>
        </span>
      </button>
      <Dialog
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
        open={open}
      >
        <DialogContent guarded mobileLayout="sheet" className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Escolher ícone</DialogTitle>
            <DialogDescription>Selecione o ícone da categoria.</DialogDescription>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus={!mobile}
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Pesquisar ícone"
              value={search}
            />
          </div>
          <div
            data-mobile-form-body
            className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-8"
          >
            {visible.map((option) => (
              <button
                aria-label={option.label}
                className={cn(
                  "grid size-11 place-items-center rounded-md border border-input bg-popover text-muted-foreground shadow-xs transition-[color,box-shadow] hover:border-brand-strong hover:text-brand-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                  option.value === value && "border-brand-strong bg-brand/10 text-brand-strong",
                )}
                key={option.value}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                title={option.label}
                type="button"
              >
                <CategoryIcon name={option.value} />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
