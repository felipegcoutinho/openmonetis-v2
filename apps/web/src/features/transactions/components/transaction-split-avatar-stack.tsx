import type { PersonOutput } from "@openmonetis/validators/people";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { SplitFormShare } from "./transaction-split-dialog.types";

export function SplitAvatarStack({
  people,
  shares,
}: {
  people: PersonOutput[];
  shares: SplitFormShare[];
}) {
  return (
    <span className="inline-flex shrink-0 -space-x-2 transition-transform group-hover:scale-105">
      {shares.slice(0, 3).map((share) => {
        const person = people.find((item) => item.id === share.personId);
        return person ? (
          <Avatar key={share.personId} size="sm">
            <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
            <AvatarFallback>{person.name[0]}</AvatarFallback>
          </Avatar>
        ) : null;
      })}
      {shares.length > 3 ? (
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
          <span aria-hidden="true">+{shares.length - 3}</span>
          <span className="sr-only">Mais {shares.length - 3} pessoas</span>
        </span>
      ) : null}
    </span>
  );
}
