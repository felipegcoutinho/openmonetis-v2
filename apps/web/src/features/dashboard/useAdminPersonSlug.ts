import { useQuery } from "@tanstack/react-query";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { buildFilterSlugMap } from "@/features/transactions/transactions.presentation";

export function useAdminPersonSlug() {
  const people = useQuery(peopleQueryOptions()).data ?? [];
  const adminPerson = people.find((person) => person.role === "admin");
  return adminPerson ? buildFilterSlugMap(people).idToSlug.get(adminPerson.id) : undefined;
}
