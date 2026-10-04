import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { ReportItem } from "./recurring-expenses-report-page.types";

export function RecurringPeople({ item }: { item: ReportItem }) {
  if (!item.splitPeople.length) {
    return (
      <span className="inline-flex items-center gap-1.5">
        <Avatar className="size-5">
          <AvatarImage
            alt={`Avatar de ${item.personName}`}
            src={item.personAvatarUrl ?? undefined}
          />
          <AvatarFallback className="text-[9px]">
            {item.personName.slice(0, 1).toLocaleUpperCase("pt-BR")}
          </AvatarFallback>
        </Avatar>
        {item.personName}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={item.splitPeople.map((person) => person.name).join(", ")}
    >
      <span className="inline-flex shrink-0 -space-x-2">
        {item.splitPeople.slice(0, 3).map((person) => (
          <Avatar key={person.id} size="sm">
            <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
            <AvatarFallback>{person.name.slice(0, 1).toLocaleUpperCase("pt-BR")}</AvatarFallback>
          </Avatar>
        ))}
        {item.splitPeople.length > 3 ? (
          <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
            <span aria-hidden="true">+{item.splitPeople.length - 3}</span>
            <span className="sr-only">Mais {item.splitPeople.length - 3} pessoas</span>
          </span>
        ) : null}
      </span>
      {item.splitPeople.length} pessoas
    </span>
  );
}
