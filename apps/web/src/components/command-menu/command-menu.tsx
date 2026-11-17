import type { CreateNoteInput } from "@openmonetis/validators/notes";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  CreditCard,
  Gauge,
  Landmark,
  LoaderCircle,
  type LucideIcon,
  NotebookPen,
  Search,
  Settings,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { MoneyValue } from "@/components/money-value";
import { dashboardNavItem, navSections } from "@/components/navigation/nav-items";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CategoryIcon } from "@/features/categories/category-icons";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { NoteDialog } from "@/features/notes/components/note-dialog";
import { useCreateNoteMutation } from "@/features/notes/notes.mutations";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import {
  formatCompactDate,
  groupTransactionRows,
} from "@/features/transactions/transactions.presentation";
import { transactionsQueryOptions } from "@/features/transactions/transactions.queries";
import { useTransactionFormOptions } from "@/features/transactions/useTransactionFormOptions";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getInitials } from "@/lib/name-presentation";
import {
  commandMenuEntityResultLimit,
  commandMenuMinimumRemoteSearchLength,
  commandMenuRemoteSearchDelayMs,
  commandMenuTransactionResultLimit,
  getCommandMenuTransactionDateRange,
  getCommandMenuTransactionEditId,
  matchesCommandMenuQuery,
} from "./command-menu-search";

type TransactionAction = Extract<TransactionInput["type"], "expense" | "income" | "transfer">;

/** Round 20px mark of a registered entity: its own logo, or a muted icon when it has none. */
function EntityMark({ logo, fallback: Fallback }: { logo: string | null; fallback: LucideIcon }) {
  return logo ? (
    <Image
      alt=""
      className="size-5 shrink-0 rounded-full object-contain"
      height={20}
      layout="fixed"
      src={logo}
      width={20}
    />
  ) : (
    <span
      aria-hidden="true"
      className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
    >
      <Fallback className="size-3" />
    </span>
  );
}

/**
 * Who the row belongs to: the person of this share in a divided purchase, otherwise the
 * purchase's person. Not a link, since the whole row already opens the transaction.
 */
function TransactionPersonAvatar({
  transaction,
}: {
  transaction: Pick<TransactionOutput, "allocation" | "personAvatarUrl" | "personName">;
}) {
  // A share without its own photo shows its initials, never the purchase owner's photo.
  const { personName: name, personAvatarUrl: avatarUrl } = transaction.allocation ?? transaction;
  return (
    <Avatar aria-label={`Pessoa: ${name}`} className="size-4" role="img" title={name}>
      <AvatarImage alt="" src={avatarUrl ?? undefined} />
      <AvatarFallback className="text-[0.5rem] leading-none">{getInitials(name)}</AvatarFallback>
    </Avatar>
  );
}

/** Shown only on the highlighted row, so the list stays scannable. */
const selectedOnlyClassName =
  "hidden shrink-0 text-muted-foreground text-xs group-data-[selected=true]/command-item:sm:inline";

type CommandMenuLink = {
  id: string;
  href: string;
  label: string;
  description?: string;
  icon: ReactNode;
  preservePeriod?: boolean;
  search?: Record<string, string>;
};

const pageLinks: CommandMenuLink[] = [
  {
    id: dashboardNavItem.href,
    href: dashboardNavItem.href,
    label: dashboardNavItem.label,
    description: "Resumo do mês",
    icon: <Gauge aria-hidden="true" className="size-4" />,
    preservePeriod: true,
  },
  ...navSections.flatMap((section) =>
    section.items.map((item) => ({
      id: `${item.href}${item.search ? `?${new URLSearchParams(item.search)}` : ""}`,
      href: item.href,
      label: item.label,
      description: item.description,
      icon: item.icon,
      preservePeriod: item.preservePeriod,
      search: item.search,
    })),
  ),
  {
    id: "/settings",
    href: "/settings",
    label: "Ajustes",
    description: "Preferências, segurança e integrações",
    icon: <Settings aria-hidden="true" className="size-4" />,
  },
];

const transactionActions: Array<{
  type: TransactionAction;
  label: string;
  keywords: string;
  icon: ReactNode;
}> = [
  {
    type: "expense",
    label: "Nova despesa",
    keywords: "gasto compra pagamento",
    icon: <ArrowUpRight aria-hidden="true" className="size-4 text-destructive" />,
  },
  {
    type: "income",
    label: "Nova receita",
    keywords: "entrada salario recebimento",
    icon: <ArrowDownLeft aria-hidden="true" className="size-4 text-success" />,
  },
  {
    type: "transfer",
    label: "Nova transferência",
    keywords: "mover saldo entre contas",
    icon: <ArrowLeftRight aria-hidden="true" className="size-4 text-info" />,
  },
];

const shortcutKey = "k";

export function CommandMenu({
  enabled,
  open,
  onOpenChange,
}: {
  enabled: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [transactionAction, setTransactionAction] = useState<TransactionAction | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const formOptions = useTransactionFormOptions({ enabled: enabled && open });
  const createNote = useCreateNoteMutation();
  const debouncedQuery = useDebouncedValue(query.trim(), commandMenuRemoteSearchDelayMs);
  const remoteSearchEnabled =
    enabled && open && debouncedQuery.length >= commandMenuMinimumRemoteSearchLength;
  const transactionsQuery = useQuery({
    ...transactionsQueryOptions({
      q: debouncedQuery,
      ...getCommandMenuTransactionDateRange(),
      sort: "recent",
      page: 1,
      pageSize: commandMenuTransactionResultLimit,
    }),
    enabled: remoteSearchEnabled,
  });
  const currentPeriod = new URLSearchParams(location.searchStr).get("period") ?? undefined;

  useEffect(() => {
    if (!enabled) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== shortcutKey || !(event.metaKey || event.ctrlKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      onOpenChange(!open);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, open, onOpenChange]);

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) setQuery("");
    onOpenChange(nextOpen);
  }

  function goTo(link: CommandMenuLink) {
    handleOpenChange(false);
    const period = link.preservePeriod ? currentPeriod : undefined;
    void navigate({
      to: link.href as never,
      search: { ...link.search, ...(period ? { period } : {}) } as never,
    });
  }

  async function openTransaction(type: TransactionAction) {
    handleOpenChange(false);
    if (await formOptions.ensureLoaded()) setTransactionAction(type);
  }

  const trimmedQuery = query.trim();
  const visiblePages = pageLinks.filter((link) =>
    matchesCommandMenuQuery(trimmedQuery, link.label, link.description),
  );
  const visibleActions = transactionActions.filter((action) =>
    matchesCommandMenuQuery(trimmedQuery, action.label, action.keywords, "lancamento"),
  );
  const noteActionVisible = matchesCommandMenuQuery(trimmedQuery, "Nova anotação nota tarefa");
  const entityLinks: CommandMenuLink[] = trimmedQuery
    ? [
        ...formOptions.accounts
          .filter((account) => !account.isArchived)
          .map((account) => ({
            id: `account:${account.id}`,
            href: `/accounts/${account.id}`,
            label: account.name,
            description: "Conta",
            icon: <EntityMark fallback={Landmark} logo={account.logo} />,
          })),
        ...formOptions.cards
          .filter((card) => card.status === "active")
          .map((card) => ({
            id: `card:${card.id}`,
            href: `/cards/${card.id}`,
            label: card.name,
            description: "Cartão",
            icon: <EntityMark fallback={CreditCard} logo={card.logo} />,
          })),
        ...formOptions.categories.map((category) => ({
          id: `category:${category.id}`,
          href: `/categories/${category.id}`,
          label: category.name,
          description: "Categoria",
          icon: (
            <span
              aria-hidden="true"
              className="grid size-5 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground"
            >
              <CategoryIcon className="size-3" name={category.icon} />
            </span>
          ),
        })),
        ...formOptions.people
          .filter((person) => person.status === "active")
          .map((person) => ({
            id: `person:${person.id}`,
            href: `/people/${person.id}`,
            label: person.name,
            description: "Pessoa",
            icon: (
              <Avatar aria-hidden="true" className="size-5" size="sm">
                <AvatarImage alt="" src={person.avatarUrl ?? undefined} />
                <AvatarFallback className="text-[0.5625rem] leading-none">
                  {getInitials(person.name)}
                </AvatarFallback>
              </Avatar>
            ),
          })),
      ]
        .filter((link) => matchesCommandMenuQuery(trimmedQuery, link.label, link.description))
        .slice(0, commandMenuEntityResultLimit * 4)
    : [];
  const transactions = remoteSearchEnabled ? (transactionsQuery.data?.items ?? []) : [];
  const searchingTransactions =
    trimmedQuery.length >= commandMenuMinimumRemoteSearchLength &&
    (trimmedQuery !== debouncedQuery || transactionsQuery.isFetching);

  return (
    <>
      <Dialog onOpenChange={handleOpenChange} open={open}>
        <DialogContent
          className="top-[8svh] translate-y-0 gap-0 overflow-hidden p-0 data-open:animate-none data-closed:animate-none sm:top-[14svh] sm:max-w-xl"
          showCloseButton={false}
        >
          <DialogTitle className="sr-only">Buscar no OpenMonetis</DialogTitle>
          <DialogDescription className="sr-only">
            Busque páginas, lançamentos, contas, cartões, categorias e pessoas, ou crie um
            lançamento.
          </DialogDescription>
          <Command loop shouldFilter={false}>
            <CommandInput
              aria-label="Buscar"
              onValueChange={setQuery}
              placeholder="Buscar páginas, lançamentos, contas…"
              value={query}
            />
            <CommandList className="max-h-[min(60svh,26rem)]">
              {searchingTransactions ? null : (
                <CommandEmpty>Nenhum resultado para “{trimmedQuery}”.</CommandEmpty>
              )}

              {visibleActions.length || noteActionVisible ? (
                <CommandGroup heading="Ações">
                  {visibleActions.map((action) => (
                    <CommandItem
                      key={action.type}
                      onSelect={() => void openTransaction(action.type)}
                      value={`action:${action.type}`}
                    >
                      {action.icon}
                      <span className="flex-1 font-medium">{action.label}</span>
                    </CommandItem>
                  ))}
                  {noteActionVisible ? (
                    <CommandItem
                      onSelect={() => {
                        handleOpenChange(false);
                        setNoteOpen(true);
                      }}
                      value="action:note"
                    >
                      <NotebookPen aria-hidden="true" className="size-4 text-warning" />
                      <span className="flex-1 font-medium">Nova anotação</span>
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              ) : null}

              {entityLinks.length ? (
                <CommandGroup heading="Cadastros">
                  {entityLinks.map((link) => (
                    <CommandItem key={link.id} onSelect={() => goTo(link)} value={link.id}>
                      {link.icon}
                      <span className="min-w-0 flex-1 truncate font-medium">{link.label}</span>
                      <span className="shrink-0 text-muted-foreground text-xs">
                        {link.description}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}

              {visiblePages.length ? (
                <CommandGroup heading="Ir para">
                  {visiblePages.map((link) => (
                    <CommandItem key={link.id} onSelect={() => goTo(link)} value={link.id}>
                      {link.icon}
                      <span className="min-w-0 flex-1 truncate font-medium">{link.label}</span>
                      {link.description ? (
                        <span className={selectedOnlyClassName}>{link.description}</span>
                      ) : null}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : null}
              {transactions.length ? (
                <CommandGroup heading="Lançamentos">
                  {groupTransactionRows(transactions).map(({ transaction, splitConnector }) => (
                    <CommandItem
                      key={transaction.id}
                      onSelect={() => {
                        handleOpenChange(false);
                        const editId = getCommandMenuTransactionEditId(transaction.id);
                        void navigate({
                          to: "/transactions",
                          search: {
                            period: transaction.period,
                            ...(editId ? { edit: editId } : { q: transaction.name }),
                          },
                        });
                      }}
                      value={`transaction:${transaction.id}`}
                    >
                      {/* Same link the transactions table draws between the shares of one purchase:
                          from this logo's center down to the next row's logo. */}
                      {splitConnector && splitConnector !== "end" ? (
                        <span
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-5 h-full w-px bg-muted-foreground/50"
                        />
                      ) : null}
                      <span className="relative z-10 inline-flex shrink-0 rounded-full bg-popover">
                        {transaction.invoicePaymentCardLogo ? (
                          <Image
                            alt=""
                            className="size-6 shrink-0 rounded-full object-contain"
                            height={24}
                            layout="fixed"
                            src={transaction.invoicePaymentCardLogo}
                            width={24}
                          />
                        ) : (
                          <EstablishmentLogo
                            categoryIcon={transaction.categoryIcon}
                            editable={false}
                            name={transaction.name}
                            size={24}
                          />
                        )}
                      </span>
                      <span className="grid min-w-0 flex-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate font-medium">{transaction.name}</span>
                          <TransactionPersonAvatar transaction={transaction} />
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {[formatCompactDate(transaction.purchaseDate), transaction.categoryName]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <MoneyValue
                        amount={transaction.allocation?.amount ?? transaction.amount}
                        className="shrink-0 font-medium text-sm tabular-nums"
                      />
                    </CommandItem>
                  ))}
                  <CommandItem
                    onSelect={() => {
                      handleOpenChange(false);
                      void navigate({
                        to: "/transactions",
                        search: {
                          q: debouncedQuery,
                          ...(currentPeriod ? { period: currentPeriod } : {}),
                        },
                      });
                    }}
                    value="transactions:all"
                  >
                    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center">
                      <Search className="size-4 text-muted-foreground" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                      Ver todos os lançamentos com “{debouncedQuery}”
                    </span>
                  </CommandItem>
                </CommandGroup>
              ) : null}

              {searchingTransactions && !transactions.length ? (
                <div
                  aria-live="polite"
                  className="flex items-center gap-2 px-4 py-3 text-muted-foreground text-xs"
                >
                  <LoaderCircle aria-hidden="true" className="size-3.5 animate-spin" />
                  Buscando lançamentos…
                </div>
              ) : null}
            </CommandList>
            {transactionsQuery.isError && remoteSearchEnabled ? (
              <p className="border-t px-4 py-2 text-destructive text-xs" role="status">
                Não foi possível buscar lançamentos agora.
              </p>
            ) : null}
            <div
              aria-hidden="true"
              className="hidden items-center gap-4 border-t px-4 py-2 text-muted-foreground text-xs sm:flex"
            >
              <span>
                <kbd className="font-medium font-sans text-foreground">↑↓</kbd> navegar
              </span>
              <span>
                <kbd className="font-medium font-sans text-foreground">↵</kbd> abrir
              </span>
              <span>
                <kbd className="font-medium font-sans text-foreground">esc</kbd> fechar
              </span>
              <span className="ml-auto">Lançamentos dos últimos 12 meses</span>
            </div>
          </Command>
        </DialogContent>
      </Dialog>

      {transactionAction ? (
        <TransactionDialog
          accounts={formOptions.accounts}
          cards={formOptions.cards}
          categories={formOptions.categories}
          defaultPeriod={currentPeriod}
          defaultType={transactionAction}
          key={transactionAction}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setTransactionAction(null);
          }}
          open
          people={formOptions.people}
          transaction={null}
        />
      ) : null}

      <NoteDialog
        key={noteOpen ? "command-note-open" : "command-note-closed"}
        note={null}
        onOpenChange={setNoteOpen}
        onSubmit={async (input) => {
          await createNote.mutateAsync(input as CreateNoteInput);
          setNoteOpen(false);
        }}
        open={noteOpen}
        pending={createNote.isPending}
      />
    </>
  );
}
