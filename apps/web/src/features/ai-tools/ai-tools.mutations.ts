import type { AiProvider } from "@openmonetis/domain/ai-providers";
import type { ActivateAiToolInput, InstallAiToolInput } from "@openmonetis/validators/ai-tools";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { activateAiTool, installAiTool } from "./ai-tools.api";
import { aiToolKeys } from "./ai-tools.queries";

export function useInstallAiToolMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, ...input }: InstallAiToolInput & { provider: AiProvider }) =>
      installAiTool(provider, input),
    onSettled: () => client.invalidateQueries({ queryKey: aiToolKeys.all }),
  });
}

export function useActivateAiToolMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ provider, ...input }: ActivateAiToolInput & { provider: AiProvider }) =>
      activateAiTool(provider, input),
    onSettled: () => client.invalidateQueries({ queryKey: aiToolKeys.all }),
  });
}
