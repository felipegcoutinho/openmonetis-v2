import { paletteSampleSummary } from "../preferences.presentation";

/**
 * A miniature screen in the palette: canvas, a header strip, a card with the main button and the
 * income and expense colours, in the palette's own typeface and corners. It fills its frame, so
 * the frame draws the outer edge; the card inside sits 6px in with an 8px radius, concentric with
 * the frame's 14px.
 */
export function PalettePreview({ name, palette }: { name: string; palette: string }) {
  return (
    <div
      aria-label={`Prévia do tema ${name}`}
      className="bg-background p-1.5 font-sans text-foreground"
      data-palette={palette}
      role="img"
    >
      <div aria-hidden="true" className="flex items-center gap-1.5 px-1.5 pt-1 pb-2">
        <span className="size-2 rounded-full bg-brand" />
        <span className="h-1.5 w-12 rounded-full bg-foreground/25" />
        <span className="ml-auto h-1.5 w-6 rounded-full bg-foreground/15" />
        <span className="h-1.5 w-6 rounded-full bg-foreground/15" />
      </div>
      <div aria-hidden="true" className="rounded-md border border-border bg-card px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate font-heading font-medium text-sm">
            {paletteSampleSummary.title}
          </span>
          <span className="shrink-0 rounded-sm bg-primary px-2 py-0.5 font-medium text-2xs text-primary-foreground">
            {paletteSampleSummary.action}
          </span>
        </div>
        <dl className="mt-2 grid gap-1 text-xs">
          {paletteSampleSummary.rows.map((row) => (
            <div className="flex items-center justify-between gap-2" key={row.label}>
              <dt className="text-muted-foreground">{row.label}</dt>
              <dd
                className={
                  row.tone === "income"
                    ? "text-success tabular-nums"
                    : "text-destructive tabular-nums"
                }
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
