import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { startPagePaths } from "./preferences.presentation";
import { userPreferencesQueryOptions } from "./preferences.queries";

/** Opens the page the user chose to start from, falling back to the overview. */
export function useStartPageNavigation() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async function navigateToStartPage() {
    const preferences = await queryClient
      .fetchQuery(userPreferencesQueryOptions())
      .catch(() => null);
    await navigate({ to: startPagePaths[preferences?.startPage ?? "dashboard"], replace: true });
  };
}
