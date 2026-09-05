import { queryOptions } from "@tanstack/react-query";
import { getDefaultUserPreferences, getUserPreferences } from "./preferences.api";

export const preferenceKeys = {
  all: ["preferences"] as const,
  defaults: ["preferences", "defaults"] as const,
};

export function defaultUserPreferencesQueryOptions() {
  return queryOptions({
    queryKey: preferenceKeys.defaults,
    queryFn: getDefaultUserPreferences,
    staleTime: 5 * 60 * 1_000,
  });
}

export function userPreferencesQueryOptions(enabled = true) {
  return queryOptions({
    queryKey: preferenceKeys.all,
    queryFn: getUserPreferences,
    enabled,
    staleTime: 5 * 60 * 1_000,
  });
}
