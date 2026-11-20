import { Moon, Sun } from "lucide-react";
import { Fragment, useId, useState } from "react";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Label } from "@/components/ui/label";
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { paletteLabels } from "../preferences.presentation";
import { PalettePreview } from "./palette-preview";
import { PaletteSwatch } from "./palette-swatch";

type PalettePickerProps<Palette extends keyof typeof paletteLabels> = {
  mode: "light" | "dark";
  label: string;
  description: string;
  palettes: readonly Palette[];
  variantLabels: Record<Palette, string>;
  value: Palette;
  disabled: boolean;
  /** Whether this mode is the one on screen now. */
  active: boolean;
  onChange: (palette: Palette) => void;
};

const modeIcons = { light: Sun, dark: Moon } as const;

/**
 * One theme card per mode: the palette's miniature on top and its picker joined below, so both
 * modes read side by side at the same size and the layout never shifts when the mode changes.
 * Moving through the list repaints the miniature, so palettes can be compared before choosing;
 * the list opens over the neighbouring card to keep this one in view.
 */
export function PreferencesPalettePicker<Palette extends keyof typeof paletteLabels>({
  mode,
  label,
  description,
  palettes,
  variantLabels,
  value,
  disabled,
  active,
  onChange,
}: PalettePickerProps<Palette>) {
  const id = useId();
  const groups = groupByFamily(palettes);
  const ModeIcon = modeIcons[mode];
  const [browsing, setBrowsing] = useState<Palette | null>(null);
  const shown = browsing ?? value;

  return (
    <div className="grid min-w-0 gap-2.5">
      <div className="flex min-h-6 items-center justify-between gap-2">
        <Label className="flex items-center gap-2 font-mono text-sm tracking-normal" htmlFor={id}>
          <ModeIcon aria-hidden="true" className="size-4 text-muted-foreground" />
          {label}
        </Label>
        {active ? (
          <span className="rounded-full bg-brand/15 px-2 py-0.5 font-medium text-2xs text-brand-strong">
            Em uso
          </span>
        ) : null}
      </div>
      <p className="sr-only" id={`${id}-description`}>
        {description}
      </p>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-card transition-[border-color,box-shadow] has-focus-visible:border-ring has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
          disabled && "opacity-50",
        )}
      >
        {/* A label of the picker, so a click or tap on the miniature opens the list too. */}
        <label className={cn("block", !disabled && "cursor-pointer")} htmlFor={id}>
          <PalettePreview
            name={`${paletteLabels[shown]} ${variantLabels[shown]}`}
            palette={`${shown}-${mode}`}
          />
        </label>
        <Select
          disabled={disabled}
          onOpenChange={(open) => {
            if (!open) setBrowsing(null);
          }}
          onValueChange={(next) => next && onChange(next as Palette)}
          value={value}
        >
          <SelectTrigger
            aria-describedby={`${id}-description`}
            className="h-11! w-full rounded-none border-0 border-border border-t bg-card px-3 focus-visible:border-border focus-visible:ring-0 disabled:opacity-100"
            id={id}
          >
            <SelectValue>
              <span className="truncate">
                {paletteLabels[value]}{" "}
                <span className="text-muted-foreground">{variantLabels[value]}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent
            align="end"
            alignItemWithTrigger={false}
            className="w-auto min-w-(--anchor-width)"
            side={mode === "light" ? "right" : "left"}
            sideOffset={16}
          >
            {groups.map((group, index) => (
              <Fragment key={group.palettes[0]}>
                {index > 0 ? <SelectSeparator /> : null}
                <SelectGroup>
                  {group.family ? <SelectLabel>{group.family}</SelectLabel> : null}
                  {group.palettes.map((palette) => (
                    <SelectItem key={palette} onFocus={() => setBrowsing(palette)} value={palette}>
                      <PaletteOption
                        grouped={Boolean(group.family)}
                        name={paletteLabels[palette]}
                        palette={`${palette}-${mode}`}
                        variant={variantLabels[palette]}
                      />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

type PaletteGroup<Palette> = {
  /** Set when the family has several variants and gets its own heading. */
  family?: string;
  palettes: Palette[];
};

/**
 * Families with several variants get their own heading; neighbouring single-variant families share
 * one unlabelled group, so the list does not turn into a heading per item.
 */
function groupByFamily<Palette extends keyof typeof paletteLabels>(palettes: readonly Palette[]) {
  const sizes = new Map<string, number>();
  for (const palette of palettes) {
    sizes.set(paletteLabels[palette], (sizes.get(paletteLabels[palette]) ?? 0) + 1);
  }

  const groups: PaletteGroup<Palette>[] = [];
  for (const palette of palettes) {
    const name = paletteLabels[palette];
    const family = (sizes.get(name) ?? 0) > 1 ? name : undefined;
    const current = groups.at(-1);
    if (current && current.family === family) current.palettes.push(palette);
    else groups.push({ family, palettes: [palette] });
  }
  return groups;
}

function PaletteOption({
  grouped = false,
  name,
  palette,
  variant,
}: {
  /** Inside a family group the heading already names the family, so only the variant shows. */
  grouped?: boolean;
  name: string;
  palette: string;
  variant: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <PaletteSwatch palette={palette} />
      {grouped ? (
        <span className="truncate">
          <span className="sr-only">{name} </span>
          {variant}
        </span>
      ) : (
        <span className="truncate">
          {name} <span className="text-muted-foreground">{variant}</span>
        </span>
      )}
    </span>
  );
}
