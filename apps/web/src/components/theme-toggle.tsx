import { type ApplicationTheme, applicationThemes } from "@openmonetis/domain/preferences";
import { useNavigate } from "@tanstack/react-router";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PaletteSwatch } from "@/features/preferences/components/palette-swatch";
import {
  applicationThemeLabels,
  getPaletteName,
} from "@/features/preferences/preferences.presentation";
import { useSaveAppearance } from "@/features/preferences/useSaveAppearance";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

const modeIcons = {
  system: Monitor,
  light: Sun,
  dark: Moon,
} satisfies Record<ApplicationTheme, typeof Sun>;

/** The header's appearance menu; inside the mobile menu, `card` keeps a one-tap mode switch. */
export function ThemeToggle({ card = false, className }: { card?: boolean; className?: string }) {
  const { appearance, mode } = useTheme();
  const { saveAppearance, isPending } = useSaveAppearance();
  const navigate = useNavigate();

  if (card) {
    return (
      <Button
        aria-label="Alternar tema"
        className={cn(
          "h-20! w-full! flex-col gap-2 rounded-lg p-2 text-foreground text-xs hover:bg-accent",
          className,
        )}
        disabled={isPending}
        onClick={() => saveAppearance({ theme: mode === "dark" ? "light" : "dark" })}
        type="button"
        variant="outline"
      >
        <ModeIcon className="size-5 text-brand-strong" />
        <span>Tema</span>
      </Button>
    );
  }

  const paletteName =
    mode === "dark"
      ? getPaletteName({ mode, palette: appearance.darkPalette })
      : getPaletteName({ mode, palette: appearance.lightPalette });
  const palette = mode === "dark" ? appearance.darkPalette : appearance.lightPalette;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          aria-label={`Aparência: ${paletteName}`}
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  className={cn(
                    "relative text-muted-foreground hover:bg-muted hover:text-foreground",
                    className,
                  )}
                  disabled={isPending}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                />
              }
            />
          }
        >
          <ModeIcon className="size-4.5" />
        </TooltipTrigger>
        <TooltipContent>Aparência</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Modo</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            onValueChange={(theme: ApplicationTheme) => saveAppearance({ theme })}
            value={appearance.theme}
          >
            {applicationThemes.map((theme) => {
              const Icon = modeIcons[theme];
              return (
                <DropdownMenuRadioItem disabled={isPending} key={theme} value={theme}>
                  <Icon aria-hidden="true" className="size-4" />
                  {applicationThemeLabels[theme]}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{mode === "dark" ? "Tema escuro" : "Tema claro"}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => void navigate({ to: "/settings", search: { tab: "preferences" } })}
          >
            <PaletteSwatch palette={`${palette}-${mode}`} />
            <span className="min-w-0 flex-1 truncate">{paletteName}</span>
            <span className="shrink-0 text-muted-foreground text-xs">Trocar</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sun in light mode, moon in dark, turning as the mode changes. */
function ModeIcon({ className }: { className: string }) {
  return (
    <span aria-hidden="true" className={cn("relative grid place-items-center", className)}>
      <Sun
        className={cn(
          "absolute scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90",
          className,
        )}
      />
      <Moon
        className={cn(
          "absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0",
          className,
        )}
      />
    </span>
  );
}
