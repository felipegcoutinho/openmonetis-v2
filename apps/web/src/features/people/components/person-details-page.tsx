import { getCurrentPeriodInBrazil } from "@openmonetis/shared/date-time";
import type { PersonOutput, ReplacePersonInput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import { CalendarDays, type LucideIcon, Mail, MessageSquareText, Pencil } from "lucide-react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { EntityLoadError } from "@/components/entity-load-error";
import { Navbar } from "@/components/navigation/navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ExternalExpensesSection } from "@/features/external-expenses/components/external-expenses-section";
import { PersonConnectionPanel } from "@/features/person-connections/components/person-connection-panel";
import { PersonConnectionsManager } from "@/features/person-connections/components/person-connections-manager";
import { personConnectionsQueryOptions } from "@/features/person-connections/person-connections.queries";
import { PersonReportPanel } from "@/features/person-reports/components/person-report-panel";
import { PersonSettlementsCard } from "@/features/person-settlements/components/person-settlements-card";
import { TransactionsContainer } from "@/features/transactions/components/transactions-container";
import type { TransactionsSearch } from "@/features/transactions/transactions.presentation";
import { useLogoColors } from "@/hooks/useLogoColors";
import { cn } from "@/lib/utils";
import { useReplacePersonMutation } from "../people.mutations";
import { formatPersonCreatedAt, personStatusLabels } from "../people.presentation";
import { personFinancialSummaryQueryOptions, personQueryOptions } from "../people.queries";
import { PersonDialog } from "./person-dialog";
import { PersonFinancialSummary } from "./person-financial-summary";

type PersonDetailsPageProps = {
  personId: string;
  search: PersonDetailsSearch;
  onSearchChange: (search: Partial<PersonDetailsSearch>) => void;
};

export type PersonDetailsSearch = TransactionsSearch & {
  view?: "panel" | "transactions" | "report" | "external";
};

export function PersonDetailsPage({ personId, search, onSearchChange }: PersonDetailsPageProps) {
  const personQuery = useQuery(personQueryOptions(personId));
  const connectionsQuery = useQuery(personConnectionsQueryOptions());
  const selectedPeriod = search.period ?? getCurrentPeriodInBrazil();
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
  // The report tab only exists for external people; the account owner falls back to the panel.
  const selectedView =
    search.view === "report" && personQuery.data?.role !== "external"
      ? "panel"
      : (search.view ?? "panel");

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
        {personQuery.isError ? (
          <EntityLoadError
            error={personQuery.error}
            entity="a pessoa"
            onRetry={() => void personQuery.refetch()}
          >
            <PersonDetailsNotFound />
          </EntityLoadError>
        ) : null}
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
  return {
    personIds: [person.id],
    allowCreate: selectedView === "transactions" && person.status === "active",
    createDefaults: { personId: person.id },
    export: { fileLabel: person.name },
    header: {
      breadcrumbs: [
        { label: "Visão geral", href: "/dashboard" },
        { label: "Organização" },
        { label: "Pessoas", href: "/people" },
        { label: person.name },
      ],
      summary: <PersonSummary onEdit={onEdit} person={person} />,
    },
    periodNavigationPlacement: "afterPageHeader" as const,
    hiddenFilters: ["person"] as const,
    contentNavigation: (
      <Tabs
        className="min-w-0 max-w-full gap-0"
        onValueChange={(value) =>
          onViewChange(
            value === "external" || value === "transactions" || value === "report"
              ? value
              : "panel",
          )
        }
        value={selectedView}
      >
        <div className="min-w-0 max-w-full overflow-x-auto">
          <TabsList className="min-w-max" variant="line">
            <TabsTrigger value="panel">Painel</TabsTrigger>
            <TabsTrigger value="transactions">Lançamentos</TabsTrigger>
            {person.role === "external" ? <TabsTrigger value="report">Extrato</TabsTrigger> : null}
            {person.role === "admin" ? (
              <TabsTrigger value="external">Despesas compartilhadas</TabsTrigger>
            ) : null}
          </TabsList>
        </div>
      </Tabs>
    ),
    contentOverride:
      selectedView === "panel" ? (
        <div className="grid gap-4">
          {financialSummary}
          <PersonSettlementsCard period={period} person={person} />
          <PersonConnectionPanel person={person} />
        </div>
      ) : selectedView === "report" ? (
        <PersonReportPanel period={period} person={person} />
      ) : selectedView === "external" ? (
        <div className="grid gap-4">
          <PersonConnectionsManager />
          {hasExternalExpenses ? (
            <ExternalExpensesSection period={period} />
          ) : (
            <Card className="gap-2 p-6">
              <h2 className="font-semibold">Ainda não há uma conexão para receber despesas</h2>
              <p className="text-muted-foreground text-sm">
                Aceite uma conexão e conclua a confirmação para revisar despesas compartilhadas com
                você.
              </p>
            </Card>
          )}
        </div>
      ) : undefined,
  };
}

function PersonSummary({ person, onEdit }: { person: PersonOutput; onEdit: () => void }) {
  const isAdmin = person.role === "admin";
  const isInactive = person.status === "inactive";
  const avatarColors = useLogoColors(person.avatarUrl);
  const accentStyle = avatarColors
    ? ({ "--person-accent": avatarColors.backgroundColor } as CSSProperties)
    : undefined;

  return (
    <Card className="relative min-w-0 overflow-hidden py-0" style={accentStyle}>
      <span
        aria-hidden="true"
        className="person-accent-wash pointer-events-none absolute inset-0 rounded-[inherit]"
      />
      <CardContent className="relative flex min-w-0 items-center gap-4 p-5 sm:p-6">
        <PersonAvatar person={person} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="min-w-0 truncate font-heading font-semibold text-xl tracking-tight sm:text-2xl">
              {person.name}
            </h1>
            <Button
              aria-label={`Editar ${person.name}`}
              className="relative text-muted-foreground after:absolute after:-inset-2 after:content-[''] hover:text-foreground max-md:after:-inset-2.5"
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
                  isInactive ? "bg-muted-foreground" : "bg-success",
                )}
              />
              {personStatusLabels[person.status]}
            </Badge>
          </div>
          <dl className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground text-sm">
            <PersonDetail icon={Mail} label="E-mail">
              {person.email ?? "Sem e-mail"}
            </PersonDetail>
            <PersonDetail icon={CalendarDays} label="Cadastro">
              Cadastro em {formatPersonCreatedAt(person.createdAt)}
            </PersonDetail>
          </dl>
          {person.note ? (
            <p className="mt-2 flex max-w-2xl items-start gap-1.5 text-pretty text-muted-foreground text-sm">
              <MessageSquareText aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span className="sr-only">Observação: </span>
              <span className="min-w-0 wrap-break-word">{person.note}</span>
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PersonDetail({
  children,
  icon: Icon,
  label,
}: {
  children: ReactNode;
  icon: LucideIcon;
  label: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <dt className="shrink-0">
        <Icon aria-hidden="true" className="size-4" />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 truncate">{children}</dd>
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
