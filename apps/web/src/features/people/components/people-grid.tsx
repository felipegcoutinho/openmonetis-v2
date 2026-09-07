import type { PersonOutput } from "@openmonetis/validators/people";
import { PersonCard } from "./person-card";

type PeopleGridProps = {
  people: PersonOutput[];
  onEdit: (person: PersonOutput) => void;
  onRemove: (person: PersonOutput) => void;
};

export function PeopleGrid({ people, onEdit, onRemove }: PeopleGridProps) {
  const orderedPeople = [...people].sort((left, right) => {
    if (left.role === right.role) return 0;
    return left.role === "admin" ? -1 : 1;
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {orderedPeople.map((person) => (
        <PersonCard
          key={person.id}
          onEdit={onEdit}
          onRemove={person.role === "external" ? onRemove : undefined}
          person={person}
        />
      ))}
    </div>
  );
}
