import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { CircleDollarSign } from "lucide-react";

export function TransactionRelation({ transaction }: { transaction: TransactionOutput }) {
  if (transaction.type === "transfer") {
    return (
      <RelationLink
        id={transaction.accountId}
        logo={transaction.accountLogo}
        name={transaction.accountName}
        to="/accounts/$accountId"
      />
    );
  }

  if (transaction.cardId && transaction.cardName) {
    return (
      <RelationLink
        id={transaction.cardId}
        logo={transaction.cardLogo}
        name={transaction.cardName}
        to="/cards/$cardId"
      />
    );
  }

  return (
    <RelationLink
      id={transaction.accountId}
      logo={transaction.accountLogo}
      name={transaction.accountName}
      to="/accounts/$accountId"
    />
  );
}

export function RelationLink({
  id,
  logo,
  name,
  to,
}: {
  id: string | null;
  logo: string | null;
  name: string | null;
  to: "/accounts/$accountId" | "/cards/$cardId";
}) {
  if (!id || !name) {
    return (
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-full bg-muted">
          <CircleDollarSign className="size-4" />
        </span>
        —
      </span>
    );
  }

  const content = (
    <>
      {logo ? (
        <Image
          alt=""
          className="size-7 rounded-full object-contain"
          height={28}
          layout="fixed"
          src={logo}
          width={28}
        />
      ) : (
        <span className="grid size-7 place-items-center rounded-full bg-muted">
          <CircleDollarSign className="size-4" />
        </span>
      )}
      <span className="max-w-32 truncate">{name}</span>
    </>
  );

  if (to === "/cards/$cardId") {
    return (
      <Link
        className="inline-flex min-w-0 items-center gap-2 rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        params={{ cardId: id }}
        to={to}
      >
        {content}
      </Link>
    );
  }

  return (
    <Link
      className="inline-flex min-w-0 items-center gap-2 rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      params={{ accountId: id }}
      to={to}
    >
      {content}
    </Link>
  );
}
