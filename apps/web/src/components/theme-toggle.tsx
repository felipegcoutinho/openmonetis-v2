import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpdateUserPreferencesMutation } from "@/features/preferences/preferences.mutations";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function ThemeToggle({ card = false, className }: { card?: boolean; className?: string }) {
  const { setTheme, theme } = useTheme();
  const updatePreferences = useUpdateUserPreferencesMutation();

  function toggleTheme() {
    const isDark = document.documentElement.classList.contains("dark");
    const nextTheme = isDark ? "light" : "dark";
    setTheme(nextTheme);
    updatePreferences.mutate(
      { theme: nextTheme },
      {
        onError: () => {
          setTheme(theme);
          toast.error("Não foi possível salvar o tema.");
        },
      },
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Alternar tema"
        render={
          <Button
            className={cn(
              card
                ? "h-20! w-full! flex-col gap-2 rounded-lg p-2 text-foreground text-xs hover:bg-accent"
                : "relative text-muted-foreground hover:bg-muted hover:text-foreground",
              className,
            )}
            disabled={updatePreferences.isPending}
            size={card ? "default" : "icon"}
            type="button"
            variant={card ? "outline" : "ghost"}
          />
        }
        onClick={toggleTheme}
      >
        <span
          className={cn("relative grid size-5 place-items-center", card && "text-brand-strong")}
        >
          <Sun
            className={cn(
              "absolute scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90",
              card ? "size-5" : "size-4",
            )}
          />
          <Moon
            className={cn(
              "absolute scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0",
              card ? "size-5" : "size-4",
            )}
          />
        </span>
        {card ? <span>Tema</span> : null}
      </TooltipTrigger>
      <TooltipContent>Alternar tema</TooltipContent>
    </Tooltip>
  );
}
