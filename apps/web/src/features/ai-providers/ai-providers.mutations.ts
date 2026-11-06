import type { AiProvider } from "@openmonetis/domain/ai-providers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  disconnectAiProvider,
  startAiProviderLogin,
  submitAiProviderLoginCode,
  updateAiProvider,
} from "./ai-providers.api";
import { aiProviderKeys } from "./ai-providers.queries";

export function useStartAiProviderLoginMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProvider) => startAiProviderLogin(provider),
    onSuccess: (login) =>
      client.setQueryData(aiProviderKeys.login(login.provider, login.loginId), login),
  });
}

export function useSubmitAiProviderLoginCodeMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      loginId,
      code,
    }: {
      provider: AiProvider;
      loginId: string;
      code: string;
    }) => submitAiProviderLoginCode(provider, loginId, code),
    onSuccess: (login) => {
      client.setQueryData(aiProviderKeys.login(login.provider, login.loginId), login);
      return client.invalidateQueries({ queryKey: aiProviderKeys.list() });
    },
  });
}

export function useUpdateAiProviderMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      provider,
      preferredModel,
    }: {
      provider: AiProvider;
      preferredModel: string | null;
    }) => updateAiProvider(provider, { preferredModel }),
    onSuccess: () => client.invalidateQueries({ queryKey: aiProviderKeys.list() }),
  });
}

export function useDisconnectAiProviderMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (provider: AiProvider) => disconnectAiProvider(provider),
    onSuccess: () => client.invalidateQueries({ queryKey: aiProviderKeys.list() }),
  });
}
