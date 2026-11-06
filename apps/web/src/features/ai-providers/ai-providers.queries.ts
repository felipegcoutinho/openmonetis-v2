import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { queryOptions } from "@tanstack/react-query";
import { getAiProviderLogin, getAiProviders } from "./ai-providers.api";

const loginCheckIntervalMs = 3_000;

export const aiProviderKeys = {
  all: ["ai-providers"] as const,
  list: () => [...aiProviderKeys.all, "list"] as const,
  login: (provider: AiProvider, loginId: string) =>
    [...aiProviderKeys.all, "login", provider, loginId] as const,
};

export function aiProvidersQueryOptions() {
  return queryOptions({
    queryKey: aiProviderKeys.list(),
    queryFn: ({ signal }) => getAiProviders(signal),
  });
}

/** Watches a sign-in that finishes on the vendor's page until it settles. */
export function aiProviderLoginQueryOptions(provider: AiProvider, loginId: string) {
  return queryOptions({
    queryKey: aiProviderKeys.login(provider, loginId),
    queryFn: ({ signal }) => getAiProviderLogin(provider, loginId, signal),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" || !query.state.data ? loginCheckIntervalMs : false,
  });
}
