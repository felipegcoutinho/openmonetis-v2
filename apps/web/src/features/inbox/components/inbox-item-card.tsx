import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
import type { PersonOutput } from "@openmonetis/validators/people";

import { useQuery } from "@tanstack/react-query";

import { ChevronRight, Eye, Workflow } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { inboxRuleSuggestionQueryOptions } from "@/features/inbox-rules/inbox-rules.queries";
import { getInitials } from "@/lib/name-presentation";
import { cn } from "@/lib/utils";

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
  peopleByRuleId,
  onDelete,
  onDetails,
  onDiscard,
  onProcess,
  onRestore,
  processing,
  selection,
  sourceMatch,
}: {
  item: InboxItemSummaryOutput;
  peopleByRuleId: ReadonlyMap<string, PersonOutput>;
  onDelete: () => void;
  onDetails: () => void;
  onDiscard: () => void;
  onProcess: () => void;
  onRestore: () => void;
  processing: boolean;
  selection?: { checked: boolean; onCheckedChange: (checked: boolean) => void };
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

  function rulePersonAvatar(ruleId: string) {
    const person = peopleByRuleId.get(ruleId);
    if (!person) return null;
    return (
      <Avatar
        className="size-4 overflow-hidden"
        role="img"
        aria-label={`Pessoa da regra: ${person.name}`}
        title={person.name}
      >
        {person.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
        <AvatarFallback className="text-2xs">{getInitials(person.name)}</AvatarFallback>
      </Avatar>
    );
  }

  const selectionCheckbox = selection ? (
    <Checkbox
      aria-label={`Selecionar ${getInboxItemTitle(item)}`}
      checked={selection.checked}
      // Above the stretched details button of the phone card, so ticking never opens the details.
      className="relative z-10 mt-0.5 shrink-0"
      onCheckedChange={(checked) => selection.onCheckedChange(checked === true)}
    />
  ) : null;

  return (
    <Card
      className={cn(
        "min-w-0 animate-list-item gap-0 py-0 transition-opacity duration-150 motion-reduce:transition-none",
        selection?.checked && "bg-brand/5 ring-1 ring-brand-strong/40",
        processing && "opacity-50",
      )}
    >
      <CardContent className="min-w-0 p-0 md:hidden">
        {/*
         * The whole upper part opens the details: the title is the button and its overlay covers
         * logo, rules and text, which is where a cut-off notification invites the tap. The chevron
         * only signals it; the checkbox sits above the overlay.
         */}
        <div className="relative grid min-w-0 gap-3 p-4 transition-colors duration-(--duration-fast) has-[[data-inbox-details]:active]:bg-(--pressed) has-[[data-inbox-details]:active]:duration-0">
          <div className="flex min-w-0 items-center gap-3">
            {selectionCheckbox}
            <InboxSourceLogo className="size-10" match={sourceMatch} size={40} />
            <div className="min-w-0 flex-1">
              <button
                className="block w-full text-left outline-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none] after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                data-inbox-details
                onClick={onDetails}
                type="button"
              >
                <span className="sr-only">Ver detalhes de </span>
                <span className="line-clamp-2 font-medium text-base leading-snug">
                  {getInboxItemTitle(item)}
                </span>
              </button>
              <p className="mt-1 truncate text-muted-foreground text-xs">
                {formatInboxTime(item.notificationTimestamp)} · {sourceLabel}
              </p>
            </div>
            <ChevronRight
              aria-hidden="true"
              className="-me-1.5 size-5 shrink-0 text-muted-foreground/70"
            />
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
                  {rulePersonAvatar(rule.id)}
                </Badge>
              ))}
            </div>
          ) : null}
          <p className="line-clamp-2 wrap-break-word font-mono text-muted-foreground text-sm leading-relaxed">
            {item.originalText}
          </p>
        </div>
        <div className="grid min-w-0 gap-3 border-t px-4 py-3">
          {amount ? <p className="font-semibold text-base tabular-nums">{amount}</p> : null}
          <InboxItemActions
            layout="card"
            onDelete={onDelete}
            onDiscard={onDiscard}
            onProcess={onProcess}
            onRestore={onRestore}
            processing={processing}
            status={item.status}
          />
        </div>
      </CardContent>
      <CardContent className="hidden min-w-0 gap-4 p-4 md:flex md:items-start">
        {selectionCheckbox ? <div className="pt-3">{selectionCheckbox}</div> : null}
        <InboxSourceLogo className="size-11" match={sourceMatch} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 items-center gap-1">
              <p className="min-w-0 truncate font-medium">
                {getInboxItemTitle(item)}{" "}
                <span className="font-normal text-muted-foreground text-xs">
                  · {formatInboxTime(item.notificationTimestamp)}
                </span>
              </p>
              <InboxItemDetailsButton onDetails={onDetails} />
            </div>
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
                    {rulePersonAvatar(rule.id)}
                  </Badge>
                ))
              : null}
          </div>
          <p className="mt-2 line-clamp-2 wrap-break-word font-mono text-muted-foreground text-sm leading-relaxed">
            {item.originalText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 self-center">
          {amount ? <p className="font-semibold tabular-nums">{amount}</p> : null}
          <InboxItemActions
            onDelete={onDelete}
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

/** Quiet entry to the details on desktop, beside the title it describes. */
function InboxItemDetailsButton({ onDetails }: { onDetails: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label="Ver detalhes"
        onClick={onDetails}
        render={
          <Button
            className="shrink-0 text-muted-foreground/70 hover:text-foreground"
            size="icon-xs"
            variant="ghost"
          />
        }
      >
        <Eye aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent>Ver detalhes</TooltipContent>
    </Tooltip>
  );
}
