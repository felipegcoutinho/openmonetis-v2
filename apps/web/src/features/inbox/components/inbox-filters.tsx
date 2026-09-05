import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
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
  onDateChange,
  onSourceChange,
  sourceApps,
  sourceAppName,
}: {
  accounts: AccountOutput[];
  cards: CardOutput[];
  notificationDate: string | undefined;
  notificationDates: string[];
  onDateChange: (notificationDate: string | undefined) => void;
  onSourceChange: (sourceAppName: string | undefined) => void;
  sourceApps: string[];
  sourceAppName: string | undefined;
}) {
  const activeMatch = getInboxSourceMatch(sourceAppName ?? null, accounts, cards);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Select
        onValueChange={(value) =>
          onSourceChange(typeof value === "string" && value !== "all" ? value : undefined)
        }
        value={sourceAppName ?? "all"}
      >
        <SelectTrigger aria-label="Filtrar por app de origem" className="min-w-52">
          <SelectValue>
            {sourceAppName ? (
              <span className="flex min-w-0 items-center gap-2">
                <InboxSourceLogo className="size-5" match={activeMatch} size={20} />
                <span className="truncate">{sourceAppName}</span>
              </span>
            ) : (
              "Todos os apps"
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
          onDateChange(typeof value === "string" && value !== "all" ? value : undefined)
        }
        value={notificationDate ?? "all"}
      >
        <SelectTrigger aria-label="Filtrar por data da captura" className="min-w-44">
          <SelectValue>
            {notificationDate ? formatInboxFilterDate(notificationDate) : "Todas as datas"}
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
