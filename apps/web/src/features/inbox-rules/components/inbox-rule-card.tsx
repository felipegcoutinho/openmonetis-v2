import type { InboxRuleOutput } from "@openmonetis/validators/inbox-rules";
import { Pencil, Tag, Trash2, User } from "lucide-react";
import { Fragment } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getInboxRuleConditionParts, inboxRuleMatchModeLabels } from "../inbox-rules.presentation";

export function InboxRuleCard({
  confirmingDelete,
  deleting,
  onCancelDelete,
  onConfirmDelete,
  onEdit,
  onRequestDelete,
  onToggle,
  rule,
  toggling,
}: {
  confirmingDelete: boolean;
  deleting: boolean;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onEdit: () => void;
  onRequestDelete: () => void;
  onToggle: (isActive: boolean) => void;
  rule: InboxRuleOutput;
  toggling: boolean;
}) {
  const matchMode = inboxRuleMatchModeLabels[rule.matchMode];

  return (
    <Card className="gap-0 py-0">
      <CardContent className="grid gap-3 p-3.5">
        <div className="flex items-start gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <p className="wrap-break-word font-medium">{rule.name}</p>
            <Badge variant="outline" className="text-muted-foreground">
              Prioridade {rule.priority}
            </Badge>
            {rule.isActive ? null : <Badge variant="secondary">Pausada</Badge>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                aria-label={`Editar regra ${rule.name}`}
                onClick={onEdit}
                render={
                  <Button
                    className="text-muted-foreground hover:text-foreground"
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <Pencil aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Editar</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                aria-label={`Excluir regra ${rule.name}`}
                onClick={onRequestDelete}
                render={
                  <Button
                    className="text-muted-foreground hover:text-destructive"
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <Trash2 aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Excluir</TooltipContent>
            </Tooltip>
            <Switch
              aria-label={`${rule.isActive ? "Pausar" : "Ativar"} regra ${rule.name}`}
              checked={rule.isActive}
              className="ml-1"
              disabled={toggling}
              onCheckedChange={onToggle}
            />
          </div>
        </div>

        {confirmingDelete ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5">
            <p className="text-sm">Excluir esta regra?</p>
            <div className="flex gap-2">
              <Button data-mobile-cancel onClick={onCancelDelete} size="sm" variant="outline">
                Cancelar
              </Button>
              <Button disabled={deleting} onClick={onConfirmDelete} size="sm" variant="destructive">
                Excluir
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-3 rounded-md bg-muted/40 p-3 text-sm transition-opacity",
              !rule.isActive && "opacity-60",
            )}
          >
            <section className="grid gap-1.5">
              <h3 className="text-muted-foreground text-xs">{matchMode.heading}</h3>
              <ul className="grid gap-1">
                {rule.conditions.map((condition, index) => {
                  const parts = getInboxRuleConditionParts(condition);
                  return (
                    <Fragment key={`${condition.field}-${condition.operator}-${condition.value}`}>
                      {index > 0 ? (
                        <li aria-hidden="true" className="eyebrow pl-1 text-muted-foreground">
                          {matchMode.connector}
                        </li>
                      ) : null}
                      <li className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                        <span className="text-muted-foreground">{parts.field}</span>
                        <span className="text-muted-foreground">{parts.operator}</span>
                        <span className="wrap-break-word rounded bg-background px-1.5 py-0.5 font-medium font-mono text-xs">
                          {parts.value}
                        </span>
                      </li>
                    </Fragment>
                  );
                })}
              </ul>
            </section>
            <section className="grid gap-1.5 border-border/60 border-t pt-3">
              <h3 className="text-muted-foreground text-xs">Sugere no lançamento</h3>
              <div className="flex flex-wrap gap-1.5">
                {rule.category ? (
                  <Badge variant="secondary">
                    <Tag aria-hidden="true" />
                    <span className="sr-only">Categoria:</span>
                    {rule.category.name}
                  </Badge>
                ) : null}
                {rule.person ? (
                  <Badge variant="secondary">
                    <User aria-hidden="true" />
                    <span className="sr-only">Pessoa:</span>
                    {rule.person.name}
                  </Badge>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
