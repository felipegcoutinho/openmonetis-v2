import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";

// Loads the options the transaction form needs. `ensureLoaded` reuses cached data or retries
// failed loads, so a click made while they load still opens the form, and a failure is reported
// on that same click.
export function useTransactionFormOptions({ enabled = true }: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery({ ...accountsQueryOptions(), enabled });
  const cardsQuery = useQuery({ ...cardsQueryOptions(), enabled });
  const categoriesQuery = useQuery({ ...categoriesQueryOptions(), enabled });
  const peopleQuery = useQuery({ ...peopleQueryOptions(), enabled });

  async function ensureLoaded() {
    try {
      await Promise.all([
        queryClient.ensureQueryData(accountsQueryOptions()),
        queryClient.ensureQueryData(cardsQueryOptions()),
        queryClient.ensureQueryData(categoriesQueryOptions()),
        queryClient.ensureQueryData(peopleQueryOptions()),
      ]);
      return true;
    } catch {
      toast.error("Não foi possível preparar o formulário.", {
        description: "Verifique sua conexão e tente novamente.",
      });
      return false;
    }
  }

  return {
    accounts: accountsQuery.data ?? [],
    cards: cardsQuery.data ?? [],
    categories: categoriesQuery.data ?? [],
    people: peopleQuery.data ?? [],
    ensureLoaded,
  };
}
