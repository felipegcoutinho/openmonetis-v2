import type {
  ReplaceInboxRuleInput,
  SetInboxRuleActiveInput,
} from "@openmonetis/validators/inbox-rules";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { inboxKeys } from "@/features/inbox/inbox.queries";
import {
  createInboxRule,
  deleteInboxRule,
  replaceInboxRule,
  setInboxRuleActive,
} from "./inbox-rules.api";
import { inboxRuleKeys } from "./inbox-rules.queries";

function useInboxRuleMutation<T>(mutationFn: (input: T) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxRuleKeys.all });
      queryClient.invalidateQueries({ queryKey: inboxKeys.all });
    },
  });
}

export function useCreateInboxRuleMutation() {
  return useInboxRuleMutation(createInboxRule);
}

export function useReplaceInboxRuleMutation() {
  return useInboxRuleMutation(({ id, input }: { id: string; input: ReplaceInboxRuleInput }) =>
    replaceInboxRule(id, input),
  );
}

export function useSetInboxRuleActiveMutation() {
  return useInboxRuleMutation(({ id, input }: { id: string; input: SetInboxRuleActiveInput }) =>
    setInboxRuleActive(id, input),
  );
}

export function useDeleteInboxRuleMutation() {
  return useInboxRuleMutation(({ id, expectedVersion }: { id: string; expectedVersion: number }) =>
    deleteInboxRule(id, expectedVersion),
  );
}
