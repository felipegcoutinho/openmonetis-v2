import type {
  CreateInboxRuleInput,
  InboxRuleOutput,
  InboxRuleSuggestionOutput,
  InboxRulesListOutput,
  ReplaceInboxRuleInput,
  SetInboxRuleActiveInput,
} from "@openmonetis/validators/inbox-rules";
import { requestApi } from "@/lib/api-client";

const request = <T>(path: string, init?: RequestInit) =>
  requestApi<T>(path, init, { errorMessage: "inbox_rules_request_failed" });

export const getInboxRules = () => request<InboxRulesListOutput>("/inbox-rules");

export const getInboxRuleSuggestion = (inboxItemId: string) =>
  request<InboxRuleSuggestionOutput>(`/inbox-rules/suggestions/${inboxItemId}`);

export const createInboxRule = (input: CreateInboxRuleInput) =>
  request<InboxRuleOutput>("/inbox-rules", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const replaceInboxRule = (id: string, input: ReplaceInboxRuleInput) =>
  request<InboxRuleOutput>(`/inbox-rules/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });

export const setInboxRuleActive = (id: string, input: SetInboxRuleActiveInput) =>
  request<InboxRuleOutput>(`/inbox-rules/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });

export const deleteInboxRule = (id: string, expectedVersion: number) =>
  request<{ id: string }>(`/inbox-rules/${id}?expectedVersion=${expectedVersion}`, {
    method: "DELETE",
  });
