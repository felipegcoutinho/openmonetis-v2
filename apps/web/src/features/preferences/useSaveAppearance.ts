import { toast } from "sonner";
import { type Appearance, useTheme } from "@/components/theme-provider";
import { useUpdateAppearanceMutation } from "./preferences.mutations";

/**
 * Applies an appearance change at once and saves it to the account. Every place that changes the
 * appearance saves this way, Preferences included. If a save fails, `PreferencesSynchronizer`
 * returns the app to the saved appearance once no other appearance save is pending.
 */
export function useSaveAppearance() {
  const { setAppearance } = useTheme();
  const updateAppearance = useUpdateAppearanceMutation();

  function saveAppearance(next: Partial<Appearance>) {
    setAppearance(next);
    updateAppearance.mutate(next, {
      onError: () => toast.error("Não foi possível salvar o tema."),
    });
  }

  return { saveAppearance, isPending: updateAppearance.isPending };
}
