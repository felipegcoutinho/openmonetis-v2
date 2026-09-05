import { queryOptions } from "@tanstack/react-query";
import { getInboxRuleSuggestion, getInboxRules } from "./inbox-rules.api";

export const inboxRuleKeys = {
  all: ["inbox-rules"] as const,
  list: () => ["inbox-rules", "list"] as const,
  suggestions: () => ["inbox-rules", "suggestions"] as const,
  suggestion: (inboxItemId: string) => ["inbox-rules", "suggestions", inboxItemId] as const,
};

export const inboxRulesQueryOptions = () =>
  queryOptions({ queryKey: inboxRuleKeys.list(), queryFn: getInboxRules });

export const inboxRuleSuggestionQueryOptions = (inboxItemId: string) =>
  queryOptions({
    queryKey: inboxRuleKeys.suggestion(inboxItemId),
    queryFn: () => getInboxRuleSuggestion(inboxItemId),
    staleTime: 0,
  });
