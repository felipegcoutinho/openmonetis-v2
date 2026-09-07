import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  CategoryTransactionsPage,
  type CategoryTransactionsSearch,
} from "@/features/categories/components/category-transactions-page";
import { validateTransactionsSearch } from "@/features/transactions/transactions.presentation";

export const Route = createFileRoute("/categories_/$categoryId")({
  component: CategoryTransactionsRoute,
  validateSearch: validateCategoryTransactionsSearch,
});

function CategoryTransactionsRoute() {
  const { categoryId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <CategoryTransactionsPage
      categoryId={categoryId}
      onSearchChange={(nextSearch) =>
        navigate({
          replace: true,
          search: (previous) => ({ ...previous, ...nextSearch }),
        })
      }
      search={search}
    />
  );
}

function validateCategoryTransactionsSearch(
  search: Record<string, unknown>,
): CategoryTransactionsSearch {
  const { categories, type, ...categorySearch } = validateTransactionsSearch(search);

  const scope = z.union([z.literal("all"), z.uuid()]).safeParse(search.personScope);
  return { ...categorySearch, personScope: scope.success ? scope.data : undefined };
}
