import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { LoaderCircle } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MobilePicker as Popover,
  MobilePickerContent as PopoverContent,
  MobilePickerTrigger as PopoverTrigger,
} from "@/components/forms/mobile-picker";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  useRemoveEstablishmentLogoMutation,
  useSetEstablishmentLogoMutation,
} from "../establishments.mutations";
import { getEstablishmentInitials } from "../establishments.presentation";
import { establishmentLogoSearchQueryOptions } from "../establishments.queries";

export function EstablishmentLogoPicker({
  children,
  name,
  selectedDomain,
}: {
  children: ReactNode;
  name: string;
  selectedDomain: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(name);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const deferredQuery = useDeferredValue(query.trim());
  const search = useQuery({
    ...establishmentLogoSearchQueryOptions(deferredQuery),
    enabled: open && deferredQuery.length >= 2,
  });
  const setLogo = useSetEstablishmentLogoMutation(name);
  const removeLogo = useRemoveEstablishmentLogoMutation(name);
  const pending = setLogo.isPending || removeLogo.isPending;

  useEffect(() => {
    if (!open) return;

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus({ preventScroll: true });
    });

    return () => cancelAnimationFrame(frame);
  }, [open]);

  const select = async (domain: string | null) => {
    try {
      if (domain) await setLogo.mutateAsync(domain);
      else await removeLogo.mutateAsync();
      setOpen(false);
    } catch {
      toast.error("Não foi possível atualizar o logo.");
    }
  };
  return (
    <Popover
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setQuery(name);
      }}
      open={open}
    >
      <PopoverTrigger render={children as ReactElement} />
      <PopoverContent
        title="Logo do estabelecimento"
        align="start"
        className="w-80 gap-3 p-3"
        initialFocus={false}
      >
        <div>
          <p className="font-medium text-sm">Logo do estabelecimento</p>
          <p className="truncate text-muted-foreground text-xs">{name}</p>
        </div>
        <Input
          aria-label="Buscar marca"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar marca..."
          ref={searchInputRef}
          value={query}
        />
        {search.isFetching ? (
          <div className="grid h-24 place-items-center">
            <LoaderCircle
              aria-label="Buscando logos"
              className="size-5 animate-spin text-muted-foreground"
            />
          </div>
        ) : (
          <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-0.5">
            <button
              className={cn(
                "grid justify-items-center gap-1 rounded-md p-2 text-xs hover:bg-muted disabled:opacity-50",
                selectedDomain === null && "ring-2 ring-ring",
              )}
              disabled={pending}
              onClick={() => void select(null)}
              type="button"
            >
              <span className="grid size-10 place-items-center rounded-full bg-brand/10 font-semibold text-brand-strong">
                {getEstablishmentInitials(name)}
              </span>
              <span>Iniciais</span>
            </button>
            {search.data?.map((result) => (
              <button
                className={cn(
                  "grid min-w-0 justify-items-center gap-1 rounded-md p-2 text-xs hover:bg-muted disabled:opacity-50",
                  selectedDomain === result.domain && "ring-2 ring-ring",
                )}
                disabled={pending}
                key={result.domain}
                onClick={() => void select(result.domain)}
                title={result.name}
                type="button"
              >
                <Image
                  alt={`Logo de ${result.name}`}
                  className="size-10 rounded-md object-contain"
                  height={40}
                  src={result.logoUrl}
                  width={40}
                />
                <span className="w-full truncate">{result.name}</span>
              </button>
            ))}
          </div>
        )}
        {!search.isFetching && deferredQuery.length >= 2 && search.data?.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground text-sm">
            Nenhuma marca encontrada.
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
