import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { useState } from "react";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { MoneyValue } from "@/components/money-value";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { personRoleLabels, personStatusLabels } from "@/features/people/people.presentation";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { getInitials } from "@/lib/name-presentation";
import { cn } from "@/lib/utils";
import { isPathActive, type NavLinkItem } from "./nav-items";
import { NavLink } from "./nav-link";

type NavigationPreview = "cards" | "accounts" | "people";

type PreviewNavigationMenuProps = {
  isOpen: boolean;
  items: NavLinkItem[];
  pathname: string;
};

const previewByHref: Partial<Record<string, NavigationPreview>> = {
  "/cards": "cards",
  "/accounts": "accounts",
  "/people": "people",
};

const previewSkeletonIds = ["first", "second", "third"] as const;

export function PreviewNavigationMenu({ isOpen, items, pathname }: PreviewNavigationMenuProps) {
  const [preview, setPreview] = useState<NavigationPreview | null>(null);

  return (
    <fieldset
      className={cn(
        "m-0 grid min-w-0 items-start gap-2 border-0 p-1",
        preview ? "w-[43rem] grid-cols-[23rem_1fr]" : "w-[23rem] grid-cols-1",
      )}
      data-preview-open={preview ? "true" : "false"}
      data-preview-navigation-menu
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPreview(null);
      }}
      onPointerLeave={() => setPreview(null)}
    >
      <div className="grid content-start gap-1 rounded-sm bg-popover/95 p-2 shadow-xl ring-1 ring-border/80 backdrop-blur-sm">
        {items.map((item) => {
          const itemPreview = previewByHref[item.href];
          const active = !item.isShortcut && isPathActive(pathname, item.href);
          const selected = itemPreview === preview;

          return (
            <NavLink
              className={cn(
                "group flex items-start gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                (active || selected) && "bg-accent text-accent-foreground",
              )}
              href={item.href}
              key={item.href}
              onFocus={() => setPreview(itemPreview ?? null)}
              onPointerEnter={() => setPreview(itemPreview ?? null)}
              preservePeriod={item.preservePeriod}
              search={item.search}
            >
              <span className="mt-0.5 shrink-0 text-brand-strong">{item.icon}</span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="font-medium">{item.label}</span>
                <span className="whitespace-nowrap text-muted-foreground text-xs leading-snug">
                  {item.description}
                </span>
              </span>
              {itemPreview ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              ) : null}
            </NavLink>
          );
        })}
      </div>

      {preview ? (
        <div className="rounded-sm bg-popover/95 p-2 shadow-xl ring-1 ring-border/80 backdrop-blur-sm">
          {preview === "cards" ? <CardsPreview enabled={isOpen} /> : null}
          {preview === "accounts" ? <AccountsPreview enabled={isOpen} /> : null}
          {preview === "people" ? <PeoplePreview enabled={isOpen} /> : null}
        </div>
      ) : null}
    </fieldset>
  );
}

function CardsPreview({ enabled }: { enabled: boolean }) {
  const cardsQuery = useQuery({
    ...cardsQueryOptions(),
    enabled,
    staleTime: 60_000,
  });
  const cards = (cardsQuery.data ?? []).filter((card) => card.status === "active").slice(0, 4);

  return (
    <PreviewPanel
      description="Faturas do mês atual"
      footerHref="/cards"
      footerLabel="Ver todos os cartões"
      title="Seus cartões"
    >
      <PreviewQueryState
        emptyDescription="Cadastre um cartão para acompanhar faturas e limites por aqui."
        emptyTitle="Nenhum cartão ativo"
        isEmpty={!cards.length}
        isError={cardsQuery.isError}
        isLoading={cardsQuery.isLoading || !enabled}
        onRetry={() => cardsQuery.refetch()}
      >
        {cards.map((card) => (
          <CardPreviewItem card={card} key={card.id} />
        ))}
      </PreviewQueryState>
    </PreviewPanel>
  );
}

function AccountsPreview({ enabled }: { enabled: boolean }) {
  const accountsQuery = useQuery({
    ...accountsQueryOptions(),
    enabled,
    staleTime: 60_000,
  });
  const accounts = (accountsQuery.data ?? []).filter((account) => !account.isArchived).slice(0, 4);

  return (
    <PreviewPanel
      description="Saldos no mês atual"
      footerHref="/accounts"
      footerLabel="Ver todas as contas"
      title="Suas contas"
    >
      <PreviewQueryState
        emptyDescription="Cadastre uma conta para consultar saldos e extratos por aqui."
        emptyTitle="Nenhuma conta ativa"
        isEmpty={!accounts.length}
        isError={accountsQuery.isError}
        isLoading={accountsQuery.isLoading || !enabled}
        onRetry={() => accountsQuery.refetch()}
      >
        {accounts.map((account) => (
          <AccountPreviewItem account={account} key={account.id} />
        ))}
      </PreviewQueryState>
    </PreviewPanel>
  );
}

function PeoplePreview({ enabled }: { enabled: boolean }) {
  const peopleQuery = useQuery({
    ...peopleQueryOptions(),
    enabled,
    staleTime: 60_000,
  });
  const people = (peopleQuery.data ?? []).slice(0, 4);

  return (
    <PreviewPanel
      description="Participantes dos seus lançamentos"
      footerHref="/people"
      footerLabel="Ver todas as pessoas"
      title="Suas pessoas"
    >
      <PreviewQueryState
        emptyDescription="Cadastre uma pessoa para organizar lançamentos e divisões de despesas."
        emptyTitle="Nenhuma pessoa cadastrada"
        isEmpty={!people.length}
        isError={peopleQuery.isError}
        isLoading={peopleQuery.isLoading || !enabled}
        onRetry={() => peopleQuery.refetch()}
      >
        {people.map((person) => (
          <PersonPreviewItem key={person.id} person={person} />
        ))}
      </PreviewQueryState>
    </PreviewPanel>
  );
}

function PreviewPanel({
  children,
  description,
  footerHref,
  footerLabel,
  title,
}: {
  children: React.ReactNode;
  description: string;
  footerHref: "/accounts" | "/cards" | "/people";
  footerLabel: string;
  title: string;
}) {
  return (
    <section className="flex min-h-64 flex-col" aria-label={title}>
      <div className="px-2 py-1 pb-2">
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="grid content-start gap-1">{children}</div>
      <Link
        className="mt-auto flex items-center justify-between rounded-sm px-2 py-2 font-medium text-brand-strong text-xs transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        to={footerHref}
      >
        {footerLabel}
        <ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </section>
  );
}

function PreviewQueryState({
  children,
  emptyDescription,
  emptyTitle,
  isEmpty,
  isError,
  isLoading,
  onRetry,
}: {
  children: React.ReactNode;
  emptyDescription: string;
  emptyTitle: string;
  isEmpty: boolean;
  isError: boolean;
  isLoading: boolean;
  onRetry: () => void;
}) {
  if (isLoading) {
    return previewSkeletonIds.map((id) => (
      <div className="flex items-center gap-3 rounded-sm px-2 py-2" key={id}>
        <Skeleton className="size-8 shrink-0 rounded-full" />
        <div className="grid flex-1 gap-2">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-3 w-40" />
        </div>
      </div>
    ));
  }

  if (isError) {
    return (
      <div className="mx-2 grid min-h-36 place-items-center rounded-sm border border-dashed p-4 text-center">
        <div>
          <p className="font-medium text-sm">Não foi possível carregar o resumo</p>
          <p className="mt-1 text-muted-foreground text-xs">Tente novamente em instantes.</p>
          <button
            className="mt-3 rounded-md px-2 py-1 font-medium text-brand-strong text-xs hover:bg-brand/10 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={onRetry}
            type="button"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="mx-2 grid min-h-36 place-items-center rounded-sm border border-dashed p-4 text-center">
        <div>
          <p className="font-medium text-sm">{emptyTitle}</p>
          <p className="mt-1 max-w-56 text-muted-foreground text-xs leading-relaxed">
            {emptyDescription}
          </p>
        </div>
      </div>
    );
  }

  return children;
}

function CardPreviewItem({ card }: { card: CardOutput }) {
  return (
    <Link
      className="flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      params={{ cardId: card.id }}
      to="/cards/$cardId"
    >
      <FinanceLogo logo={card.logo} name={card.name} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium text-sm">{card.name}</span>
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <span>Fatura atual:</span>
          <MoneyValue amount={card.invoiceSummary.amount} className="font-medium text-foreground" />
        </span>
      </span>
    </Link>
  );
}

function AccountPreviewItem({ account }: { account: AccountOutput }) {
  return (
    <Link
      className="flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      params={{ accountId: account.id }}
      to="/accounts/$accountId"
    >
      <FinanceLogo logo={account.logo} name={account.name} />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="truncate font-medium text-sm">{account.name}</span>
        <span className="flex items-center gap-1 text-muted-foreground text-xs">
          <span>Saldo:</span>
          <MoneyValue amount={account.summary.balance} className="font-medium text-foreground" />
        </span>
      </span>
    </Link>
  );
}

function PersonPreviewItem({ person }: { person: PersonOutput }) {
  return (
    <Link
      className="flex items-center gap-3 rounded-sm px-2 py-2 transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      params={{ personId: person.id }}
      to="/people/$personId"
    >
      <Avatar className="size-8 overflow-hidden">
        {person.avatarUrl ? (
          <AvatarImage
            alt={`Avatar de ${person.name}`}
            className="scale-[1.06]"
            src={person.avatarUrl}
          />
        ) : null}
        <AvatarFallback className="text-[10px]">{getInitials(person.name)}</AvatarFallback>
      </Avatar>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex min-w-0 items-center gap-1.5">
          <span className="truncate font-medium text-sm">{person.name}</span>
          {person.role === "admin" ? <CurrentUserBadge /> : null}
        </span>
        <span className="truncate text-muted-foreground text-xs">
          {personRoleLabels[person.role]} · {personStatusLabels[person.status]}
        </span>
      </span>
    </Link>
  );
}

function FinanceLogo({ logo, name }: { logo: string | null; name: string }) {
  if (!logo) {
    return (
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted font-medium text-muted-foreground text-[10px]">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full">
      <Image
        alt={`Logo de ${name}`}
        className="size-8 rounded-full object-contain"
        height={32}
        layout="fixed"
        src={logo}
        width={32}
      />
    </span>
  );
}
