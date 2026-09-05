import { createFileRoute } from "@tanstack/react-router";
import { CategoryTransactionsPage } from "@/features/categories/components/category-transactions-page";
import {
  type TransactionsSearch,
  validateTransactionsSearch,
} from "@/features/transactions/transactions.presentation";

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

function validateCategoryTransactionsSearch(search: Record<string, unknown>): TransactionsSearch {
  const { categories, type, ...categorySearch } = validateTransactionsSearch(search);

  return categorySearch;
}
