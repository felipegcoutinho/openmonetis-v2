import type { DashboardWidgetPreferences } from "@openmonetis/domain/dashboard";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { resetDashboardWidgetPreferences, updateDashboardWidgetPreferences } from "./dashboard.api";
import { isDefaultDashboardWidgetPreferences } from "./dashboard.presentation";
import { dashboardKeys } from "./dashboard.queries";

export function useSaveDashboardWidgetPreferencesMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (preferences: DashboardWidgetPreferences) =>
      isDefaultDashboardWidgetPreferences(preferences)
        ? resetDashboardWidgetPreferences()
        : updateDashboardWidgetPreferences(preferences),
    // Widgets are added, removed and moved in place, so the grid reflects the change immediately.
    onMutate: async (preferences) => {
      await queryClient.cancelQueries({ queryKey: dashboardKeys.preferences() });
      const previous = queryClient.getQueryData<DashboardWidgetPreferences>(
        dashboardKeys.preferences(),
      );
      queryClient.setQueryData(dashboardKeys.preferences(), preferences);
      return { previous };
    },
    onError: (_error, _preferences, context) => {
      if (context?.previous) {
        queryClient.setQueryData(dashboardKeys.preferences(), context.previous);
      }
    },
    onSuccess: (preferences) => {
      queryClient.setQueryData(dashboardKeys.preferences(), preferences);
    },
  });
}
