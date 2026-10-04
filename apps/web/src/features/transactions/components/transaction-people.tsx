import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { Link } from "@tanstack/react-router";

import { MoneyValue } from "@/components/money-value";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function TransactionPeople({ transaction }: { transaction: TransactionOutput }) {
  if (transaction.allocation) {
    return (
      <PersonLink
        avatarUrl={transaction.allocation.personAvatarUrl}
        id={transaction.allocation.personId}
        name={transaction.allocation.personName}
      />
    );
  }

  if (!transaction.isDivided || transaction.splitShares.length === 0) {
    return (
      <PersonLink
        avatarUrl={transaction.personAvatarUrl}
        id={transaction.personId}
        name={transaction.personName}
      />
    );
  }

  const visibleShares = transaction.splitShares.slice(0, 3);

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="inline-flex items-center gap-2 rounded-sm">
            <span className="flex -space-x-1.5">
              {visibleShares.map((share) => (
                <Link
                  className="rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  key={share.personId}
                  params={{ personId: share.personId }}
                  to="/people/$personId"
                >
                  <Avatar className="size-5 bg-background" size="sm">
                    <AvatarImage
                      alt={`Avatar de ${share.personName}`}
                      src={share.personAvatarUrl ?? undefined}
                    />
                    <AvatarFallback>{share.personName.slice(0, 1).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
              ))}
            </span>
          </span>
        }
      />
      <TooltipContent className="grid gap-1">
        {transaction.splitShares.map((share) => (
          <span className="flex items-center justify-between gap-4" key={share.personId}>
            <span>{share.personName}</span>
            <MoneyValue amount={share.amount} />
          </span>
        ))}
      </TooltipContent>
    </Tooltip>
  );
}

export function PersonLink({
  avatarUrl,
  id,
  name,
}: {
  avatarUrl: string | null;
  id: string;
  name: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        aria-label={`Pessoa: ${name}`}
        render={
          <Link
            className="inline-flex rounded-full outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            params={{ personId: id }}
            to="/people/$personId"
          />
        }
      >
        <Avatar className="size-5" size="sm">
          <AvatarImage alt="" src={avatarUrl ?? undefined} />
          <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
      </TooltipTrigger>
      <TooltipContent>{name}</TooltipContent>
    </Tooltip>
  );
}
