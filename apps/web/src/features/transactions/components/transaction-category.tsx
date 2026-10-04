import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";

import { CategoryIcon } from "@/features/categories/category-icons";

export function TransactionCategory({
  categoryLabel,
  period,
  transaction,
}: {
  categoryLabel: string | null;
  period: string;
  transaction: TransactionOutput;
}) {
  if (!categoryLabel) return null;

  const content = (
    <>
      <CategoryIcon aria-hidden="true" className="size-3.5" name={transaction.categoryIcon} />
      <span>{categoryLabel}</span>
    </>
  );

  if (!transaction.categoryId) {
    return <span className="inline-flex items-center gap-1">{content}</span>;
  }

  return (
    <Link
      className="inline-flex items-center gap-1 rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      params={{ categoryId: transaction.categoryId }}
      search={{ period }}
      to="/categories/$categoryId"
    >
      {content}
    </Link>
  );
}
