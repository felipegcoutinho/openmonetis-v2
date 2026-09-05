import {
  createDefaultDashboardWidgetPreferences,
  type DashboardWidgetPreferences,
} from "@openmonetis/domain/dashboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetDashboardWidgetPreferences, updateDashboardWidgetPreferences } from "./dashboard.api";
import { dashboardKeys } from "./dashboard.queries";

export function useSaveDashboardWidgetPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: DashboardWidgetPreferences) =>
      isDefaultPreferences(preferences)
        ? resetDashboardWidgetPreferences()
        : updateDashboardWidgetPreferences(preferences),
    onSuccess: (preferences) => {
      queryClient.setQueryData(dashboardKeys.preferences(), preferences);
    },
  });
}

function isDefaultPreferences(preferences: DashboardWidgetPreferences) {
  const defaults = createDefaultDashboardWidgetPreferences();
  return (
    preferences.hidden.length === 0 &&
    preferences.order.length === defaults.order.length &&
    preferences.order.every((widgetId, index) => widgetId === defaults.order[index])
  );
}
