import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { InboxRuleOutput } from "@openmonetis/validators/inbox-rules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatInboxFilterDate, getInboxSourceMatch } from "../inbox.presentation";
import { InboxSourceLogo } from "./inbox-source-logo";

export function InboxFilters({
  accounts,
  cards,
  notificationDate,
  notificationDates,
  onRuleChange,
  onDateChange,
  onSourceChange,
  sourceApps,
  sourceAppName,
  ruleId,
  rules,
}: {
  accounts: AccountOutput[];
  cards: CardOutput[];
  notificationDate: string | undefined;
  notificationDates: string[];
  onRuleChange: (ruleId: string | undefined) => void;
  onDateChange: (notificationDate: string | undefined) => void;
  onSourceChange: (sourceAppName: string | undefined) => void;
  sourceApps: string[];
  sourceAppName: string | undefined;
  ruleId: string | undefined;
  rules: InboxRuleOutput[];
}) {
  const activeMatch = getInboxSourceMatch(sourceAppName ?? null, accounts, cards);

  return (
    <div className="grid min-w-0 w-full grid-cols-3 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-3">
      <Select
        onValueChange={(value) =>
          onSourceChange(typeof value === "string" && value !== "all" ? value : undefined)
        }
        value={sourceAppName ?? "all"}
      >
        <SelectTrigger
          aria-label="Filtrar por app de origem"
          className="min-w-0 w-full *:data-[slot=select-value]:min-w-0 sm:min-w-52 sm:w-auto"
        >
          <SelectValue>
            {sourceAppName ? (
              <span className="flex min-w-0 items-center gap-2">
                <InboxSourceLogo className="size-5" match={activeMatch} size={20} />
                <span className="truncate">{sourceAppName}</span>
              </span>
            ) : (
              <>
                <span className="sm:hidden">Apps</span>
                <span className="hidden sm:inline">Todos os apps</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="all">Todos os apps</SelectItem>
          {sourceApps.map((source) => {
            const match = getInboxSourceMatch(source, accounts, cards);
            return (
              <SelectItem key={source} value={source}>
                <InboxSourceLogo className="size-5" match={match} size={20} />
                <span>{source}</span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) =>
          onRuleChange(typeof value === "string" && value !== "all" ? value : undefined)
        }
        value={ruleId ?? "all"}
      >
        <SelectTrigger
          aria-label="Filtrar por regra"
          className="min-w-0 w-full *:data-[slot=select-value]:min-w-0 sm:min-w-48 sm:max-w-64 sm:w-auto"
        >
          <SelectValue>
            {ruleId ? (
              <span className="min-w-0 truncate">
                {rules.find((rule) => rule.id === ruleId)?.name ?? "Regra indisponível"}
              </span>
            ) : (
              <>
                <span className="sm:hidden">Regras</span>
                <span className="hidden sm:inline">Todas as regras</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="all">Todas as regras</SelectItem>
          {rules.map((rule) => (
            <SelectItem key={rule.id} value={rule.id}>
              {rule.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        onValueChange={(value) =>
          onDateChange(typeof value === "string" && value !== "all" ? value : undefined)
        }
        value={notificationDate ?? "all"}
      >
        <SelectTrigger
          aria-label="Filtrar por data da captura"
          className="min-w-0 w-full *:data-[slot=select-value]:min-w-0 sm:min-w-44 sm:w-auto"
        >
          <SelectValue>
            {notificationDate ? (
              <span className="min-w-0 truncate">{formatInboxFilterDate(notificationDate)}</span>
            ) : (
              <>
                <span className="sm:hidden">Datas</span>
                <span className="hidden sm:inline">Todas as datas</span>
              </>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start">
          <SelectItem value="all">Todas as datas</SelectItem>
          {notificationDates.map((date) => (
            <SelectItem key={date} value={date}>
              {formatInboxFilterDate(date)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
