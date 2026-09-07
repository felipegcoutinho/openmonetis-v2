import type { PersonOutput, ReplacePersonInput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { CalendarDays, CircleHelp, Mail, MessageSquareText, Pencil, UserRound } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { Navbar } from "@/components/navigation/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalExpensesSection } from "@/features/external-expenses/components/external-expenses-section";
import { PersonConnectionPanel } from "@/features/person-connections/components/person-connection-panel";
import { PersonConnectionsManager } from "@/features/person-connections/components/person-connections-manager";
import { personConnectionsQueryOptions } from "@/features/person-connections/person-connections.queries";
import { PersonSettlementsCard } from "@/features/person-settlements/components/person-settlements-card";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import {
  formatPeriod,
  getCurrentPeriod,
  type TransactionsSearch,
} from "@/features/transactions/transactions.presentation";
import { cn } from "@/lib/utils";
import { useReplacePersonMutation } from "../people.mutations";
import {
  formatPersonCreatedAt,
  personRoleLabels,
  personStatusLabels,
} from "../people.presentation";
import { personFinancialSummaryQueryOptions, personQueryOptions } from "../people.queries";
import { PersonDialog } from "./person-dialog";
import { PersonFinancialSummary } from "./person-financial-summary";

type PersonDetailsPageProps = {
  personId: string;
  search: PersonDetailsSearch;
  onSearchChange: (search: Partial<PersonDetailsSearch>) => void;
};

export type PersonDetailsSearch = TransactionsSearch & {
  view?: "panel" | "transactions" | "external";
};

export function PersonDetailsPage({ personId, search, onSearchChange }: PersonDetailsPageProps) {
  const personQuery = useQuery(personQueryOptions(personId));
  const connectionsQuery = useQuery(personConnectionsQueryOptions());
  const selectedPeriod = search.period ?? getCurrentPeriod();
  const resolvedPersonId = personQuery.data?.id ?? "";
  const summaryQuery = useQuery({
    ...personFinancialSummaryQueryOptions(resolvedPersonId, selectedPeriod),
    enabled: Boolean(resolvedPersonId),
  });
  const replacePerson = useReplacePersonMutation();
  const [editing, setEditing] = useState(false);
  const recipientConnections = (connectionsQuery.data ?? []).filter(
    (connection) => connection.perspective === "recipient" && connection.status === "active",
  );
  const hasExternalExpenses = Boolean(
    personQuery.data?.role === "admin" && recipientConnections.length > 0,
  );
  const selectedView =
    search.view === "external" && !hasExternalExpenses ? "panel" : (search.view ?? "panel");

  async function updatePerson(input: ReplacePersonInput) {
    if (!resolvedPersonId) return;
    await replacePerson.mutateAsync({ id: resolvedPersonId, input });
    setEditing(false);
  }

  return (
    <ProtectedRoute>
      <main className="min-h-svh bg-background">
        <Navbar />
        {personQuery.isLoading ? <PersonDetailsLoading /> : null}
        {personQuery.isError ? <PersonDetailsNotFound /> : null}
        {personQuery.data ? (
          <>
            <TransactionsContainer
              onSearchChange={onSearchChange}
              scope={getPersonTransactionsScope(
                personQuery.data,
                selectedPeriod,
                () => setEditing(true),
                <PersonFinancialSummary
                  data={summaryQuery.data}
                  isError={summaryQuery.isError}
                  isLoading={summaryQuery.isLoading}
                />,
                selectedView,
                hasExternalExpenses,
                (view) => onSearchChange({ view, page: undefined }),
              )}
              search={search}
            />
            <PersonDialog
              onOpenChange={setEditing}
              onSubmit={(input) => updatePerson(input as ReplacePersonInput)}
              open={editing}
              person={personQuery.data}
            />
          </>
        ) : null}
      </main>
    </ProtectedRoute>
  );
}

function getPersonTransactionsScope(
  person: PersonOutput,
  period: string,
  onEdit: () => void,
  financialSummary: ReactNode,
  selectedView: NonNullable<PersonDetailsSearch["view"]>,
  hasExternalExpenses: boolean,
  onViewChange: (view: PersonDetailsSearch["view"]) => void,
) {
  const periodLabel = formatPeriod(period);

  return {
    personIds: [person.id],
    allowCreate: selectedView === "transactions" && person.status === "active",
    createDefaults: { personId: person.id },
    header: {
      breadcrumbs: [
        { label: "Visão geral", href: "/dashboard" },
        { label: "Organização" },
        { label: "Pessoas", href: "/people" },
        { label: person.name },
      ],
      summary: <PersonSummary onEdit={onEdit} periodLabel={periodLabel} person={person} />,
    },
    periodNavigationPlacement: "afterPageHeader" as const,
    hiddenFilters: ["person"] as const,
    contentNavigation: (
      <Tabs
        className="gap-0"
        onValueChange={(value) =>
          onViewChange(
            value === "external" ? "external" : value === "transactions" ? "transactions" : "panel",
          )
        }
        value={selectedView}
      >
        <TabsList variant="line">
          <TabsTrigger value="panel">Painel</TabsTrigger>
          <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
          {hasExternalExpenses ? (
            <TabsTrigger value="external">Lançamentos externos</TabsTrigger>
          ) : null}
        </TabsList>
      </Tabs>
    ),
    contentOverride:
      selectedView === "panel" ? (
        <div className="grid gap-4">
          <PersonConnectionPanel person={person} />
          {financialSummary}
          <PersonSettlementsCard period={period} person={person} />
        </div>
      ) : selectedView === "external" && hasExternalExpenses ? (
        <div className="grid gap-4">
          <PersonConnectionsManager />
          <ExternalExpensesSection period={period} />
        </div>
      ) : undefined,
  };
}

function PersonSummary({
  person,
  periodLabel,
  onEdit,
}: {
  person: PersonOutput;
  periodLabel: string;
  onEdit: () => void;
}) {
  const isAdmin = person.role === "admin";
  const isInactive = person.status === "inactive";

  return (
    <Card className="overflow-hidden py-0">
      <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-12">
        <div className="flex min-w-0 items-start gap-4">
          <PersonAvatar person={person} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-medium text-2xl tracking-tight">{person.name}</h1>
              <Button
                aria-label={`Editar ${person.name}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={onEdit}
                size="icon-xs"
                variant="ghost"
              >
                <Pencil aria-hidden="true" />
              </Button>
              {isAdmin ? <CurrentUserBadge /> : null}
              <Badge variant={isInactive ? "outline" : "secondary"}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    isInactive ? "bg-muted-foreground" : "bg-emerald-500",
                  )}
                />
                {personStatusLabels[person.status]}
              </Badge>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">Lançamentos de {periodLabel}</p>
            {person.note ? (
              <p className="mt-3 flex max-w-xl items-start gap-2 text-muted-foreground text-sm leading-relaxed">
                <MessageSquareText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span>{person.note}</span>
              </p>
            ) : null}
          </div>
        </div>

        <PersonDetailsPopover person={person} />
      </CardContent>
    </Card>
  );
}

function PersonDetailsPopover({ person }: { person: PersonOutput }) {
  return (
    <Popover>
      <PopoverTrigger render={<Button size="sm" type="button" variant="ghost" />}>
        <CircleHelp aria-hidden="true" />
        Detalhes
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div>
          <p className="font-medium">Dados da pessoa</p>
          <p className="mt-1 text-muted-foreground text-xs">
            Informações cadastrais e observações.
          </p>
        </div>
        <div className="grid gap-3">
          <PersonDetail icon={UserRound} label="Papel" value={personRoleLabels[person.role]} />
          <PersonDetail icon={Mail} label="E-mail" value={person.email ?? "Não informado"} />
          <PersonDetail
            icon={CalendarDays}
            label="Cadastro"
            value={formatPersonCreatedAt(person.createdAt)}
          />
          {person.note ? (
            <PersonDetail icon={MessageSquareText} label="Observação" value={person.note} />
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PersonDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs">{label}</p>
        <p className="wrap-break-word font-medium text-sm">{value}</p>
      </div>
    </div>
  );
}

function PersonAvatar({ person }: { person: PersonOutput }) {
  if (person.avatarUrl) {
    return (
      <Image
        alt={`Avatar de ${person.name}`}
        className="size-16 shrink-0 rounded-full object-cover"
        height={64}
        layout="fixed"
        src={person.avatarUrl}
        width={64}
      />
    );
  }

  return (
    <span className="grid size-16 shrink-0 place-items-center rounded-full bg-brand/10 font-semibold text-brand-strong text-xl">
      {person.name.slice(0, 2).toLocaleUpperCase("pt-BR")}
    </span>
  );
}

function PersonDetailsLoading() {
  return (
    <section className="app-page project-container">
      <p className="text-muted-foreground text-sm">Carregando pessoa...</p>
    </section>
  );
}

function PersonDetailsNotFound() {
  return (
    <section className="app-page project-container">
      <p className="text-destructive text-sm" role="alert">
        Pessoa não encontrada.
      </p>
    </section>
  );
}
