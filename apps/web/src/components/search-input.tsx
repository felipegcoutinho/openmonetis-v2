import { Search, X } from "lucide-react";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type SearchInputProps = Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  value: string;
  onValueChange: (value: string) => void;
  /** Sizes the wrapper (width, order); `className` styles the input itself. */
  containerClassName?: string;
};

/** Text search with a leading icon and a clear button, shared by every list page. */
export function SearchInput({
  value,
  onValueChange,
  containerClassName,
  className,
  ...props
}: SearchInputProps) {
  return (
    <div className={cn("relative w-full min-w-0", containerClassName)}>
      <Search
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        className={cn(
          "truncate pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none",
          className,
        )}
        enterKeyHint="search"
        onChange={(event) => onValueChange(event.target.value)}
        type="search"
        value={value}
        {...props}
      />
      {value ? (
        <button
          aria-label="Limpar busca"
          className="absolute top-1/2 right-1.5 grid size-7 -translate-y-1/2 place-items-center rounded-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => onValueChange("")}
          type="button"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
