import {
  createDefaultDashboardWidgetPreferences,
  type DashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSaveDashboardWidgetPreferencesMutation } from "./dashboard.mutations";
import { dashboardKeys, dashboardWidgetPreferencesQueryOptions } from "./dashboard.queries";

/** Reads the widget preferences and saves each change as soon as it is made. */
export function useDashboardWidgetEditor() {
  const queryClient = useQueryClient();
  const preferencesQuery = useQuery(dashboardWidgetPreferencesQueryOptions());
  const saveMutation = useSaveDashboardWidgetPreferencesMutation();
  const preferences = preferencesQuery.data ?? createDefaultDashboardWidgetPreferences();

  function update(change: (current: DashboardWidgetPreferences) => DashboardWidgetPreferences) {
    // Builds on the cache, which already holds earlier changes still being saved.
    const current =
      queryClient.getQueryData<DashboardWidgetPreferences>(dashboardKeys.preferences()) ??
      preferences;
    const next = change(current);
    if (next === current) return;

    saveMutation.mutate(next, {
      onError: () => toast.error("Não foi possível salvar o dashboard. Tente novamente."),
    });
  }

  return {
    canEdit: Boolean(preferencesQuery.data),
    preferences,
    preferencesQuery,
    update,
  };
}
