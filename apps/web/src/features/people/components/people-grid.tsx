import type { PersonOutput } from "@openmonetis/validators/people";
import { PersonCard } from "./person-card";

type PeopleGridProps = {
  people: PersonOutput[];
  onEdit: (person: PersonOutput) => void;
  onRemove: (person: PersonOutput) => void;
};

export function PeopleGrid({ people, onEdit, onRemove }: PeopleGridProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {people.map((person) => (
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
