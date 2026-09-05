import type {
  DashboardSnapshotOutput,
  DashboardWidgetPreferencesInput,
  DashboardWidgetPreferencesOutput,
} from "@openmonetis/validators/dashboard";
import { requestApi } from "@/lib/api-client";

export async function getDashboardSnapshot(period: string) {
  return request<DashboardSnapshotOutput>("/dashboard/snapshot", period);
}

export function getDashboardWidgetPreferences() {
  return requestApi<DashboardWidgetPreferencesOutput>("/dashboard/preferences", undefined, {
    errorMessage: "Unable to load dashboard preferences",
  });
}

export function updateDashboardWidgetPreferences(input: DashboardWidgetPreferencesInput) {
  return requestApi<DashboardWidgetPreferencesOutput>(
    "/dashboard/preferences",
    { method: "PUT", body: JSON.stringify(input) },
    { errorMessage: "Unable to update dashboard preferences" },
  );
}

export function resetDashboardWidgetPreferences() {
  return requestApi<DashboardWidgetPreferencesOutput>(
    "/dashboard/preferences",
    { method: "DELETE" },
    { errorMessage: "Unable to reset dashboard preferences" },
  );
}

async function request<T>(path: string, period: string) {
  const params = new URLSearchParams({ period });
  return requestApi<T>(`${path}?${params.toString()}`, undefined, {
    errorMessage: "Unable to load dashboard metrics",
  });
}
