import { cn } from "@/lib/utils";

/**
 * A palette's canvas with its typeface, corners, accent, income and expense colours.
 * `data-palette` applies the palette's tokens to this element only, so the swatch never drifts
 * from the real theme. The "Aa" is drawn by CSS, so it never joins an option's text.
 */
export function PaletteSwatch({ palette, className }: { palette: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-5 w-14 shrink-0 items-center justify-center gap-1 rounded-sm border border-border bg-background font-heading font-semibold text-2xs text-foreground! leading-none before:content-['Aa']",
        className,
      )}
      data-palette={palette}
    >
      <span className="flex gap-0.5">
        <span className="size-2 rounded-full bg-brand" />
        <span className="size-2 rounded-full bg-success" />
        <span className="size-2 rounded-full bg-destructive" />
      </span>
    </span>
  );
}
