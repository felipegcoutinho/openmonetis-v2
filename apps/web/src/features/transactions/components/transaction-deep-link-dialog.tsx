import { useQuery } from "@tanstack/react-query";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { transactionDetailQueryOptions } from "../transactions.queries";
import { TransactionDialog } from "./transaction-dialog";

export function TransactionDeepLinkDialog({
  transactionId,
  onOpenChange,
}: {
  transactionId: string | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  const transaction = useQuery({
    ...transactionDetailQueryOptions(transactionId ?? ""),
    enabled: Boolean(transactionId),
  });
  const accounts = useQuery(accountsQueryOptions());
  const cards = useQuery(cardsQueryOptions());
  const categories = useQuery(categoriesQueryOptions());
  const people = useQuery(peopleQueryOptions());

  return (
    <TransactionDialog
      accounts={accounts.data ?? []}
      cards={cards.data ?? []}
      categories={categories.data ?? []}
      mode="edit"
      onOpenChange={onOpenChange}
      open={Boolean(transactionId && transaction.data)}
      people={people.data ?? []}
      transaction={transaction.data ?? null}
    />
  );
}
