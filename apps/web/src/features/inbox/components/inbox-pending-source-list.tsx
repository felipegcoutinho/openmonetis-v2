import type { InboxPageOutput } from "@openmonetis/validators/inbox";

import { Image } from "@unpic/react";
import { CreditCard, Landmark } from "lucide-react";

import { MoneyValue } from "@/components/money-value";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { Skeleton } from "@/components/ui/skeleton";

import { InboxSourceLogo } from "./inbox-source-logo";

export function InboxPendingSourceList({
  isError,
  isLoading,
  summary,
}: {
  isError: boolean;
  isLoading: boolean;
  summary: InboxPageOutput["pendingSummary"] | undefined;
}) {
  const sourceCount = (summary?.sources.length ?? 0) + (summary?.unidentifiedCount ? 1 : 0);

  return (
    <Accordion>
      <AccordionItem className="border-0" value="pending-sources">
        <AccordionTrigger className="items-center px-5 py-4 hover:no-underline sm:px-6">
          <div className="flex min-w-0 flex-1 items-center justify-between gap-4 pr-2">
            <div className="min-w-0">
              <span className="block font-medium text-sm">Por origem</span>
              <span className="mt-0.5 block truncate font-normal text-muted-foreground text-xs">
                Cartões e contas com capturas pendentes
              </span>
            </div>
            {!isLoading && !isError ? (
              <span className="shrink-0 font-normal text-muted-foreground text-xs tabular-nums">
                {sourceCount} {sourceCount === 1 ? "origem" : "origens"}
              </span>
            ) : null}
          </div>
        </AccordionTrigger>
        {/* Rows sit directly on the card, aligned with the header, instead of in a nested box. */}
        <AccordionContent className="border-t pb-0 [&_p:not(:last-child)]:mb-0">
          <section
            aria-label="Valores pendentes por cartão ou conta"
            className="max-h-72 overflow-y-auto focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
            tabIndex={sourceCount > 4 ? 0 : undefined}
          >
            <ul className="divide-y">
              {isLoading
                ? ["first", "second", "third"].map((key) => (
                    <li className="flex items-center gap-3 px-5 py-3 sm:px-6" key={key}>
                      <Skeleton className="size-9 shrink-0 rounded-full" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="mt-1.5 h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-24" />
                    </li>
                  ))
                : null}

              {!isLoading && isError ? (
                <li className="px-5 py-4 text-muted-foreground text-sm sm:px-6">
                  Não foi possível carregar o resumo.
                </li>
              ) : null}

              {!isLoading && !isError
                ? summary?.sources.map((source) => (
                    <InboxPendingSourceRow
                      amount={source.amount}
                      count={source.count}
                      key={`${source.kind}:${source.id}`}
                      kind={source.kind}
                      logo={source.logo}
                      name={source.name}
                    />
                  ))
                : null}

              {!isLoading && !isError && summary?.unidentifiedCount ? (
                <InboxPendingSourceRow
                  amount={summary.unidentifiedAmount}
                  count={summary.unidentifiedCount}
                  kind="unidentified"
                  logo={null}
                  name="Não identificado"
                />
              ) : null}

              {!isLoading && !isError && sourceCount === 0 ? (
                <li className="px-5 py-4 text-muted-foreground text-sm sm:px-6">
                  Nenhuma captura pendente.
                </li>
              ) : null}
            </ul>
          </section>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

export function InboxPendingSourceRow({
  amount,
  count,
  kind,
  logo,
  name,
}: {
  amount: number;
  count: number;
  kind: "account" | "card" | "unidentified";
  logo: string | null;
  name: string;
}) {
  return (
    <li className="flex items-center gap-3 px-5 py-3 sm:px-6">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
        <InboxPendingSourceIcon kind={kind} logo={logo} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{name}</p>
        <p className="mt-0.5 text-muted-foreground text-xs">
          {kind === "card" ? "Cartão" : kind === "account" ? "Conta" : "Origem"} · {count}{" "}
          {count === 1 ? "captura" : "capturas"}
        </p>
      </div>
      <MoneyValue amount={amount} className="shrink-0 font-medium text-sm tabular-nums" />
    </li>
  );
}

export function InboxPendingSourceIcon({
  kind,
  logo,
}: {
  kind: "account" | "card" | "unidentified";
  logo: string | null;
}) {
  if (!logo) {
    if (kind === "account") return <Landmark aria-hidden="true" className="size-4" />;
    if (kind === "card") return <CreditCard aria-hidden="true" className="size-4" />;
    return <InboxSourceLogo className="size-9" match={null} size={36} />;
  }

  return (
    <Image
      alt=""
      className="size-9 rounded-full object-contain outline-1 -outline-offset-1 outline-black/10 dark:outline-white/10"
      height={36}
      layout="fixed"
      src={logo}
      width={36}
    />
  );
}
