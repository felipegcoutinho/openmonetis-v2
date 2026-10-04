import type { PersonOutput } from "@openmonetis/validators/people";
import { BadgeCheck, Link2 } from "lucide-react";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";
import type { SplitFormShare } from "./transaction-split-dialog.types";
import { parsePercentage } from "./transaction-split-input";
export function TransactionSplitShareRow({
  splitMode,
  activeConnectedPersonIds,
  togglePerson,
  updateAmount,
  updatePercentage,
  person,
  share,
  percentageValue,
  isPrimary,
  isSelected,
}: {
  splitMode: ReturnType<typeof useTransactionSplitEditor>["splitMode"];
  activeConnectedPersonIds: ReturnType<
    typeof useTransactionSplitEditor
  >["activeConnectedPersonIds"];
  togglePerson: ReturnType<typeof useTransactionSplitEditor>["togglePerson"];
  updateAmount: ReturnType<typeof useTransactionSplitEditor>["updateAmount"];
  updatePercentage: ReturnType<typeof useTransactionSplitEditor>["updatePercentage"];
  person: PersonOutput;
  share: SplitFormShare | undefined;
  percentageValue: string;
  isPrimary: boolean;
  isSelected: boolean;
}) {
  return (
    <div
      className={cn(
        "grid items-center gap-3 rounded-lg border p-3 transition-colors sm:grid-cols-[minmax(0,1fr)_9rem]",
        isSelected
          ? "border-brand-strong/20 bg-brand/5"
          : "border-border bg-muted/20 hover:bg-muted/40",
      )}
      key={person.id}
    >
      <label
        className="flex min-w-0 cursor-pointer items-center gap-2.5"
        htmlFor={`split-person-${person.id}`}
      >
        <Checkbox
          aria-label={`Incluir ${person.name} na divisão`}
          checked={isSelected}
          id={`split-person-${person.id}`}
          onCheckedChange={(checked) => togglePerson(person.id, Boolean(checked))}
        />
        <Avatar size="sm">
          <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
          <AvatarFallback>{person.name[0]}</AvatarFallback>
        </Avatar>
        <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
          <span className="truncate">{person.name}</span>
          {person.role === "admin" ? (
            <CurrentUserBadge />
          ) : activeConnectedPersonIds.has(person.id) ? (
            <Badge variant="secondary">
              <Link2 aria-hidden="true" /> Conta conectada
            </Badge>
          ) : isPrimary ? (
            <span className="shrink-0 text-info" title="Pessoa principal do lançamento">
              <BadgeCheck aria-hidden="true" className="size-4" />
              <span className="sr-only">Pessoa principal do lançamento</span>
            </span>
          ) : null}
        </span>
      </label>
      {share ? (
        splitMode === "percentage" ? (
          <div className="space-y-1">
            <div className="relative">
              <Input
                aria-invalid={
                  parsePercentage(percentageValue) <= 0 || parsePercentage(percentageValue) > 100
                }
                aria-label={`Percentual de ${person.name}`}
                className="pr-8 text-right tabular-nums"
                inputMode="decimal"
                maxLength={6}
                onChange={(event) => updatePercentage(person.id, event.target.value)}
                placeholder="0"
                type="text"
                value={percentageValue}
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm">
                %
              </span>
            </div>
            <p className="text-right text-muted-foreground text-xs">
              <MoneyValue amount={Number(share.amount) || 0} />
            </p>
          </div>
        ) : (
          <CurrencyInput
            aria-label={`Valor de ${person.name}`}
            onValueChange={(nextAmount) => updateAmount(person.id, nextAmount)}
            placeholder="R$ 0,00"
            value={share.amount}
          />
        )
      ) : (
        <div className="hidden h-9 sm:block" />
      )}
    </div>
  );
}
