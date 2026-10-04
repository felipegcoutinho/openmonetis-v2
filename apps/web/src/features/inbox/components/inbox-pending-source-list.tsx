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
              <span className="mt-0.5 block truncate font-normal text-current/70 text-xs">
                Cartões e contas com capturas pendentes
              </span>
            </div>
            {!isLoading && !isError ? (
              <span className="shrink-0 font-normal text-current/70 text-xs tabular-nums">
                {sourceCount} {sourceCount === 1 ? "origem" : "origens"}
              </span>
            ) : null}
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-current/15 border-t px-5 pt-4 pb-5 sm:px-6 [&_p:not(:last-child)]:mb-0">
          <section
            aria-label="Valores pendentes por cartão ou conta"
            className="max-h-64 overflow-y-auto rounded-lg border border-current/10 bg-current/5"
            tabIndex={sourceCount > 4 ? 0 : undefined}
          >
            <ul className="divide-y divide-current/10">
              {isLoading
                ? ["first", "second", "third"].map((key) => (
                    <li className="flex items-center gap-3 p-3" key={key}>
                      <Skeleton className="size-9 shrink-0 rounded-lg bg-current/15 before:via-current/20" />
                      <div className="min-w-0 flex-1">
                        <Skeleton className="h-4 w-32 bg-current/15 before:via-current/20" />
                        <Skeleton className="mt-1.5 h-3 w-20 bg-current/15 before:via-current/20" />
                      </div>
                      <Skeleton className="h-5 w-24 bg-current/15 before:via-current/20" />
                    </li>
                  ))
                : null}

              {!isLoading && isError ? (
                <li className="p-4 text-current/70 text-sm">Não foi possível carregar o resumo.</li>
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
                <li className="p-4 text-current/70 text-sm">Nenhuma captura pendente.</li>
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
    <li className="flex items-center gap-3 p-3">
      <span className="grid size-10 shrink-0 place-items-center">
        <InboxPendingSourceIcon kind={kind} logo={logo} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-sm">{name}</p>
        <p className="text-current/70 text-xs">
          {kind === "card" ? "Cartão" : kind === "account" ? "Conta" : "Origem"} · {count}{" "}
          {count === 1 ? "captura" : "capturas"}
        </p>
      </div>
      <MoneyValue amount={amount} className="shrink-0 font-medium text-sm" />
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
    if (kind === "account") return <Landmark aria-hidden="true" className="size-5" />;
    if (kind === "card") return <CreditCard aria-hidden="true" className="size-5" />;
    return <InboxSourceLogo className="size-8" match={null} size={32} />;
  }

  return (
    <Image
      alt=""
      className="size-8 rounded-full object-contain"
      height={32}
      layout="fixed"
      src={logo}
      width={32}
    />
  );
}
