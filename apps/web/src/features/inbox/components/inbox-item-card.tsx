import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";

import { useQuery } from "@tanstack/react-query";

import { Workflow } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent } from "@/components/ui/card";

import { inboxRuleSuggestionQueryOptions } from "@/features/inbox-rules/inbox-rules.queries";

import {
  formatInboxAmount,
  formatInboxTime,
  getInboxItemTitle,
  type InboxSourceMatch,
} from "../inbox.presentation";
import { InboxItemActions } from "./inbox-item-actions";
import { InboxSourceLogo } from "./inbox-source-logo";

export function InboxItemCard({
  item,
  onDelete,
  onDetails,
  onDiscard,
  onProcess,
  onRestore,
  processing,
  sourceMatch,
}: {
  item: InboxItemSummaryOutput;
  onDelete: () => void;
  onDetails: () => void;
  onDiscard: () => void;
  onProcess: () => void;
  onRestore: () => void;
  processing: boolean;
  sourceMatch: InboxSourceMatch | null;
}) {
  const amount = formatInboxAmount(item.parsedAmount);
  const suggestionQuery = useQuery({
    ...inboxRuleSuggestionQueryOptions(item.id),
    enabled: item.status === "pending",
  });
  const sourceLabel = sourceMatch
    ? `${sourceMatch.kind === "card" ? "Cartão" : "Conta"} · ${sourceMatch.name}`
    : (item.sourceAppName ?? "App financeiro");

  return (
    <Card className="min-w-0 gap-0 py-0">
      <CardContent className="min-w-0 p-0 md:hidden">
        <div className="grid min-w-0 gap-3 p-4">
          <div className="flex min-w-0 items-center gap-3">
            <InboxSourceLogo className="size-10" match={sourceMatch} size={40} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-medium text-base leading-snug">
                {getInboxItemTitle(item)}
              </p>
              <p className="mt-1 truncate text-muted-foreground text-xs">
                {formatInboxTime(item.notificationTimestamp)} · {sourceLabel}
              </p>
            </div>
          </div>
          {item.status === "pending" && suggestionQuery.data?.appliedRules.length ? (
            <div className="flex min-w-0 flex-wrap gap-1.5">
              {suggestionQuery.data.appliedRules.map((rule) => (
                <Badge
                  className="max-w-full gap-1 text-xs"
                  key={rule.id}
                  title={`Regra aplicada: ${rule.name}`}
                  variant="outline"
                >
                  <Workflow aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">{rule.name}</span>
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="line-clamp-2 wrap-break-word text-muted-foreground text-sm leading-relaxed">
            {item.originalText}
          </p>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2 border-t px-4 py-3">
          {amount ? <p className="mr-auto font-semibold text-base tabular-nums">{amount}</p> : null}
          <InboxItemActions
            className="ml-auto"
            onDelete={onDelete}
            onDetails={onDetails}
            onDiscard={onDiscard}
            onProcess={onProcess}
            onRestore={onRestore}
            processing={processing}
            status={item.status}
          />
        </div>
      </CardContent>
      <CardContent className="hidden min-w-0 gap-4 p-4 md:flex md:items-start">
        <InboxSourceLogo className="size-11" match={sourceMatch} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium">
              {getInboxItemTitle(item)}{" "}
              <span className="font-normal text-muted-foreground text-xs">
                · {formatInboxTime(item.notificationTimestamp)}
              </span>
            </p>
            <Badge variant="secondary">{sourceLabel}</Badge>
            {item.status === "pending"
              ? suggestionQuery.data?.appliedRules.map((rule) => (
                  <Badge
                    className="max-w-full gap-1"
                    key={rule.id}
                    title={`Regra aplicada: ${rule.name}`}
                    variant="outline"
                  >
                    <Workflow aria-hidden="true" className="size-3 shrink-0" />
                    <span className="truncate">Regra · {rule.name}</span>
                  </Badge>
                ))
              : null}
          </div>
          <p className="mt-2 line-clamp-2 wrap-break-word text-muted-foreground text-sm leading-relaxed">
            {item.originalText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-center">
          {amount ? <p className="font-semibold tabular-nums">{amount}</p> : null}
          <InboxItemActions
            onDelete={onDelete}
            onDetails={onDetails}
            onDiscard={onDiscard}
            onProcess={onProcess}
            onRestore={onRestore}
            processing={processing}
            status={item.status}
          />
        </div>
      </CardContent>
    </Card>
  );
}
