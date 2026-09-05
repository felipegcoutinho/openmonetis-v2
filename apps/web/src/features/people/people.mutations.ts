import type { ReplacePersonInput } from "@openmonetis/validators/people";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";
import { refreshFinancialQueries } from "@/lib/financial-query-invalidation";
import { createPerson, deletePerson, replacePerson } from "./people.api";
import { personKeys } from "./people.queries";
export function useCreatePersonMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createPerson,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
export function useReplacePersonMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReplacePersonInput }) =>
      replacePerson(id, input),
    onSuccess: async (person) => {
      client.setQueryData(personKeys.detail(person.id), person);
      await refreshFinancialQueries(client);
      if (person.role === "admin") authClient.$store.notify("$sessionSignal");
    },
  });
}
export function useDeletePersonMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: deletePerson,
    onSuccess: () => refreshFinancialQueries(client),
  });
}
