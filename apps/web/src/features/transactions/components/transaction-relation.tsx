import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight, CircleDollarSign, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

export function TransactionRelation({ transaction }: { transaction: TransactionOutput }) {
  if (transaction.type === "transfer") {
    if (transaction.sourceAccountName && transaction.destinationAccountName) {
      return <TransferRelation transaction={transaction} />;
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

export function TransferLogos({
  transaction,
  size = 28,
}: {
  transaction: Pick<TransactionOutput, "sourceAccountLogo" | "destinationAccountLogo">;
  size?: 16 | 28;
}) {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center">
      <TransferLogo logo={transaction.sourceAccountLogo} size={size} />
      <TransferLogo
        className={size === 16 ? "-ml-1.5" : "-ml-2.5"}
        logo={transaction.destinationAccountLogo}
        size={size}
      />
    </span>
  );
}

// Two account logos stacked diagonally, sized like a single 40px list avatar.
export function TransferAvatar({
  transaction,
}: {
  transaction: Pick<TransactionOutput, "sourceAccountLogo" | "destinationAccountLogo">;
}) {
  return (
    <span aria-hidden="true" className="relative block size-10 shrink-0">
      <TransferLogo
        className="absolute top-0 left-0"
        logo={transaction.sourceAccountLogo}
        size={28}
      />
      <TransferLogo
        className="absolute right-0 bottom-0"
        logo={transaction.destinationAccountLogo}
        size={28}
      />
    </span>
  );
}

function TransferLogo({
  className,
  logo,
  size,
}: {
  className?: string;
  logo: string | null;
  size: 16 | 28;
}) {
  const sizeClassName = size === 16 ? "size-4 ring-1" : "size-7 ring-2";
  const ringClassName = "rounded-full bg-card ring-card";

  return logo ? (
    <Image
      alt=""
      className={cn(sizeClassName, ringClassName, "object-contain", className)}
      height={size}
      layout="fixed"
      src={logo}
      width={size}
    />
  ) : (
    <span
      className={cn(
        sizeClassName,
        ringClassName,
        "grid place-items-center bg-muted text-muted-foreground",
        className,
      )}
    >
      <Landmark className={size === 16 ? "size-2.5" : "size-3.5"} />
    </span>
  );
}

function TransferRelation({ transaction }: { transaction: TransactionOutput }) {
  const accountLinkClassName =
    "block min-w-0 max-w-20 truncate rounded-sm hover:text-brand-strong hover:underline focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <span
      className="inline-flex min-w-0 items-center gap-2"
      title={`De ${transaction.sourceAccountName} para ${transaction.destinationAccountName}`}
    >
      <TransferLogos transaction={transaction} />
      <span className="inline-flex min-w-0 items-center gap-1">
        <span className="sr-only">De </span>
        <AccountNameLink
          className={accountLinkClassName}
          id={transaction.sourceAccountId}
          name={transaction.sourceAccountName}
        />
        <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="sr-only"> para </span>
        <AccountNameLink
          className={accountLinkClassName}
          id={transaction.destinationAccountId}
          name={transaction.destinationAccountName}
        />
      </span>
    </span>
  );
}

function AccountNameLink({
  className,
  id,
  name,
}: {
  className: string;
  id: string | null;
  name: string | null;
}) {
  if (!id) return <span className="block min-w-0 max-w-20 truncate">{name}</span>;
  return (
    <Link className={className} params={{ accountId: id }} to="/accounts/$accountId">
      {name}
    </Link>
  );
}
