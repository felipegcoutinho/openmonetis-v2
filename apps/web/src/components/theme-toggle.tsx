import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useUpdateUserPreferencesMutation } from "@/features/preferences/preferences.mutations";
import { cn } from "@/lib/utils";
import { useTheme } from "./theme-provider";

export function ThemeToggle({ className }: { className?: string }) {
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
              "relative text-muted-foreground hover:bg-muted hover:text-foreground",
              className,
            )}
            disabled={updatePreferences.isPending}
            size="icon"
            type="button"
            variant="ghost"
          />
        }
        onClick={toggleTheme}
      >
        <Sun className="size-4 scale-100 rotate-0 transition-transform dark:scale-0 dark:-rotate-90" />
        <Moon className="absolute size-4 scale-0 rotate-90 transition-transform dark:scale-100 dark:rotate-0" />
      </TooltipTrigger>
      <TooltipContent>Alternar tema</TooltipContent>
    </Tooltip>
  );
}
