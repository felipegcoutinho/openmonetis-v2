import {
  UpdateUserPreferencesInputSchema,
  type UserPreferencesOutput,
} from "@openmonetis/validators/preferences";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useUpdateUserPreferencesMutation } from "./preferences.mutations";
import {
  getAppearance,
  getFormPreferences,
  preferencesMutationErrorMessage,
} from "./preferences.presentation";
import { defaultUserPreferencesQueryOptions } from "./preferences.queries";
import { useSaveAppearance } from "./useSaveAppearance";

export function usePreferencesForm(preferences: UserPreferencesOutput) {
  const queryClient = useQueryClient();
  const updatePreferences = useUpdateUserPreferencesMutation();
  const { saveAppearance } = useSaveAppearance();
  const [isRestoring, setIsRestoring] = useState(false);
  const form = useForm({
    defaultValues: getFormPreferences(preferences),
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
            ([key, entry]) => entry !== form.options.defaultValues?.[key as keyof typeof value],
          ),
        );
        if (Object.keys(changes).length === 0) return;
        const saved = await updatePreferences.mutateAsync(
          UpdateUserPreferencesInputSchema.parse(changes),
        );
        form.reset(getFormPreferences(saved));
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
      form.reset(getFormPreferences(defaults), { keepDefaultValues: true });
      saveAppearance(getAppearance(defaults));
      toast.info("Padrões carregados", {
        description: "O tema padrão já foi aplicado. Salve para aplicar o restante.",
      });
    } catch {
      toast.error("Não foi possível carregar os padrões. Tente novamente.");
    } finally {
      setIsRestoring(false);
    }
  }

  /** Returns the form to the saved values. The appearance is already saved, so it stays. */
  function discardChanges() {
    form.reset();
  }

  return { form, isRestoring, restoreDefaults, discardChanges };
}

export type PreferencesFormApi = ReturnType<typeof usePreferencesForm>["form"];
