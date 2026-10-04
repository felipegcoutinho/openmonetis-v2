import { CreditCard, Landmark } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import type { ReportItem } from "./recurring-expenses-report-page.types";

export function RecurringDestination({ item }: { item: ReportItem }) {
  const isCard = Boolean(item.cardName);
  const name = item.cardName ?? item.accountName;
  const logo = item.cardLogo ?? item.accountLogo;
  if (!name) return "Não informada";

  const DestinationIcon = isCard ? CreditCard : Landmark;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <Avatar className="size-5" title={isCard ? `Cartão ${name}` : `Conta ${name}`}>
        <AvatarImage alt="" src={logo ?? undefined} />
        <AvatarFallback>
          <DestinationIcon aria-hidden="true" className="size-3" />
        </AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}
