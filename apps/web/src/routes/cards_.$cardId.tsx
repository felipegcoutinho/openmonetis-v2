import { createFileRoute } from "@tanstack/react-router";
import { CardInvoicesPage } from "@/features/cards/components/card-invoices-page";
import {
  type TransactionsSearch,
  validateTransactionsSearch,
} from "@/features/transactions/transactions.presentation";

export const Route = createFileRoute("/cards_/$cardId")({
  head: () => ({ meta: [{ title: "Fatura do cartão · OpenMonetis" }] }),
  component: CardInvoicesRoute,
  validateSearch: validateCardInvoiceSearch,
});

function CardInvoicesRoute() {
  const { cardId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <CardInvoicesPage
      cardId={cardId}
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

function validateCardInvoiceSearch(search: Record<string, unknown>): TransactionsSearch {
  const { accounts, cards, paymentMethod, type, ...invoiceSearch } =
    validateTransactionsSearch(search);

  return invoiceSearch;
}
