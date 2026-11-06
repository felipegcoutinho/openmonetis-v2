import type { PersonOutput } from "@openmonetis/validators/people";
import type { ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInitials } from "@/lib/name-presentation";

/** A person inside a select: avatar and name, or `placeholder` while none is chosen. */
export function PersonOption({
  person,
  placeholder = "Selecione",
}: {
  person?: PersonOutput;
  placeholder?: ReactNode;
}) {
  if (!person) return <span className="truncate">{placeholder}</span>;

  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar size="sm">
        <AvatarImage alt="" src={person.avatarUrl ?? undefined} />
        <AvatarFallback>{getInitials(person.name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{person.name}</span>
    </span>
  );
}
