import type { PersonOutput } from "@openmonetis/validators/people";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function PersonOption({ person }: { person?: PersonOutput }) {
  if (!person) return <span>Selecione</span>;
  return (
    <span className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
        <AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span>{person.name}</span>
    </span>
  );
}
