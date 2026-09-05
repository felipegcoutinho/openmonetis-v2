import {
  UpdateUserPreferencesInputSchema,
  type UserPreferencesOutput,
} from "@openmonetis/validators/preferences";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import { useUpdateUserPreferencesMutation } from "./preferences.mutations";
import { preferencesMutationErrorMessage } from "./preferences.presentation";
import { defaultUserPreferencesQueryOptions } from "./preferences.queries";

export function usePreferencesForm(preferences: UserPreferencesOutput) {
  const queryClient = useQueryClient();
  const updatePreferences = useUpdateUserPreferencesMutation();
  const { setTheme } = useTheme();
  const [isRestoring, setIsRestoring] = useState(false);
  const form = useForm({
    defaultValues: preferences,
    validators: {
      onSubmit: ({ value }) =>
        UpdateUserPreferencesInputSchema.safeParse(value).success
          ? undefined
          : "Revise as preferências selecionadas.",
    },
    onSubmitInvalid: () => toast.error("Revise as preferências selecionadas."),
    onSubmit: async ({ value }) => {
      try {
        const changes = Object.fromEntries(
          Object.entries(value).filter(
            ([key, entry]) =>
              entry !== form.options.defaultValues?.[key as keyof UserPreferencesOutput],
          ),
        );
        if (Object.keys(changes).length === 0) return;
        const saved = await updatePreferences.mutateAsync(
          UpdateUserPreferencesInputSchema.parse(changes),
        );
        form.reset(saved);
        setTheme(saved.theme);
        toast.success("Preferências salvas");
      } catch (error) {
        toast.error(preferencesMutationErrorMessage(error));
      }
    },
  });

  async function restoreDefaults() {
    setIsRestoring(true);
    try {
      const defaults = await queryClient.fetchQuery(defaultUserPreferencesQueryOptions());
      form.reset(defaults, { keepDefaultValues: true });
      toast.info("Padrões carregados", {
        description: "Salve para aplicar ou descarte as alterações.",
      });
    } catch {
      toast.error("Não foi possível carregar os padrões. Tente novamente.");
    } finally {
      setIsRestoring(false);
    }
  }

  return { form, isRestoring, restoreDefaults };
}

export type PreferencesFormApi = ReturnType<typeof usePreferencesForm>["form"];
