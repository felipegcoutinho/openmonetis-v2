import type { PersonOutput } from "@openmonetis/validators/people";

import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { PersonOption } from "./transaction-import-options";

export function RowSelect({
  disabled,
  onChange,
  people,
  value,
}: {
  disabled: boolean;
  onChange: (id: string) => void;
  people: PersonOutput[];
  value: string;
}) {
  const selectedPerson = people.find((person) => person.id === value);
  return (
    <Select disabled={disabled} onValueChange={(next) => onChange(next as string)} value={value}>
      <SelectTrigger className="h-8 w-full">
        <SelectValue placeholder="Pessoa">
          <PersonOption compact person={selectedPerson} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {people.map((person) => (
          <SelectItem key={person.id} value={person.id}>
            <PersonOption compact person={person} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
