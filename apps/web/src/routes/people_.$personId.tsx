import { createFileRoute } from "@tanstack/react-router";
import {
  PersonDetailsPage,
  type PersonDetailsSearch,
} from "@/features/people/components/person-details-page";
import { validateTransactionsSearch } from "@/features/transactions/transactions.presentation";

export const Route = createFileRoute("/people_/$personId")({
  head: () => ({ meta: [{ title: "Detalhe da pessoa · OpenMonetis" }] }),
  component: PersonDetailsRoute,
  validateSearch: validatePersonDetailsSearch,
});

function PersonDetailsRoute() {
  const { personId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <PersonDetailsPage
      onSearchChange={(nextSearch) =>
        navigate({
          replace: true,
          search: (previous) => ({ ...previous, ...nextSearch }),
        })
      }
      personId={personId}
      search={search}
    />
  );
}

function validatePersonDetailsSearch(search: Record<string, unknown>): PersonDetailsSearch {
  const { people, ...detailsSearch } = validateTransactionsSearch(search);

  return {
    ...detailsSearch,
    view:
      search.view === "external"
        ? "external"
        : search.view === "transactions"
          ? "transactions"
          : search.view === "panel"
            ? "panel"
            : undefined,
  };
}
