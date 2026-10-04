import type { InboxClearableStatus, InboxItemStatus } from "@openmonetis/domain/inbox";
import type { InboxItemSummaryOutput } from "@openmonetis/validators/inbox";
import type { InboxRuleSuggestionOutput } from "@openmonetis/validators/inbox-rules";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Inbox,
  RefreshCw,
  Trash2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { accountsQueryOptions } from "@/features/accounts/accounts.queries";
import { cardsQueryOptions } from "@/features/cards/cards.queries";
import { categoriesQueryOptions } from "@/features/categories/categories.queries";
import { InboxRulesDialog } from "@/features/inbox-rules/components/inbox-rules-dialog";
import { describeInboxRuleSuggestion } from "@/features/inbox-rules/inbox-rules.presentation";
import {
  inboxRuleSuggestionQueryOptions,
  inboxRulesQueryOptions,
} from "@/features/inbox-rules/inbox-rules.queries";
import { peopleQueryOptions } from "@/features/people/people.queries";
import { TransactionDialog } from "@/features/transactions/components/transaction-dialog";
import {
  useClearInboxItemsMutation,
  useConfirmInboxItemMutation,
  useDeleteInboxItemMutation,
  useDiscardInboxItemMutation,
  useRestoreInboxItemMutation,
} from "../inbox.mutations";
import {
  getInboxSourceMatch,
  groupInboxItemsByDate,
  inboxStatusLabels,
} from "../inbox.presentation";
import { inboxItemsQueryOptions } from "../inbox.queries";
import { InboxClearDialog } from "./inbox-clear-dialog";
import { InboxDeleteDialog } from "./inbox-delete-dialog";
import { InboxDetailsDialog } from "./inbox-details-dialog";
import { InboxEmpty } from "./inbox-empty";
import { InboxFilters } from "./inbox-filters";
import { InboxItemCard } from "./inbox-item-card";
import { InboxLoading } from "./inbox-loading";
import { statuses } from "./inbox-page-options";
import { InboxPendingSummary } from "./inbox-pending-summary";
import { getProcessDefaults } from "./inbox-process-defaults";

export function InboxPage({
  notificationDate,
  page,
  sourceAppName,
  ruleId,
  status,
  onSearchChange,
}: {
  notificationDate: string | undefined;
  page: number;
  sourceAppName: string | undefined;
  ruleId: string | undefined;
  status: InboxItemStatus;
  onSearchChange: (search: {
    status?: InboxItemStatus;
    page?: number;
    app?: string;
    date?: string;
    rule?: string;
  }) => void;
}) {
  const query = useQuery(
    inboxItemsQueryOptions(status, sourceAppName, notificationDate, ruleId, page),
  );
  const rulesQuery = useQuery(inboxRulesQueryOptions());
  const queryClient = useQueryClient();
  const accountsQuery = useQuery(accountsQueryOptions());
  const cardsQuery = useQuery(cardsQueryOptions());
  const categoriesQuery = useQuery(categoriesQueryOptions());
  const peopleQuery = useQuery(peopleQueryOptions());
  const discardMutation = useDiscardInboxItemMutation();
  const restoreMutation = useRestoreInboxItemMutation();
  const confirmMutation = useConfirmInboxItemMutation();
  const deleteMutation = useDeleteInboxItemMutation();
  const clearMutation = useClearInboxItemsMutation();
  const [detailsItemId, setDetailsItemId] = useState<string | null>(null);
  const [processItem, setProcessItem] = useState<InboxItemSummaryOutput | null>(null);
  const [processSuggestion, setProcessSuggestion] = useState<InboxRuleSuggestionOutput | null>(
    null,
  );
  const [resolvingItemId, setResolvingItemId] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<InboxItemSummaryOutput | null>(null);
  const [clearStatus, setClearStatus] = useState<InboxClearableStatus | null>(null);
  const dataSourcesReady =
    accountsQuery.data && cardsQuery.data && categoriesQuery.data && peopleQuery.data;

  async function discard(id: string) {
    try {
      await discardMutation.mutateAsync(id);
      toast.success("Captura descartada");
    } catch {
      toast.error("Não foi possível descartar o item.");
    }
  }

  async function restore(id: string) {
    try {
      await restoreMutation.mutateAsync(id);
      toast.success("Item restaurado para pendentes");
    } catch {
      toast.error("Não foi possível restaurar o item.");
    }
  }

  async function remove(item: InboxItemSummaryOutput) {
    try {
      await deleteMutation.mutateAsync(item.id);
      toast.success("Captura excluída");
      setDeleteItem(null);
    } catch {
      toast.error("Não foi possível excluir o item.");
    }
  }

  async function clearAll() {
    if (!clearStatus) return;

    try {
      const result = await clearMutation.mutateAsync(clearStatus);
      toast.success(
        `${result.deletedCount} ${result.deletedCount === 1 ? "captura excluída" : "capturas excluídas"}`,
      );
      setClearStatus(null);
      onSearchChange({ page: undefined, app: undefined, date: undefined, rule: undefined });
    } catch {
      toast.error("Não foi possível limpar o histórico.");
    }
  }

  async function startProcessing(item: InboxItemSummaryOutput) {
    setResolvingItemId(item.id);
    let suggestion: InboxRuleSuggestionOutput | null = null;
    try {
      suggestion = await queryClient.fetchQuery(inboxRuleSuggestionQueryOptions(item.id));
    } catch {
      toast.info("As regras não puderam ser verificadas. Revise os campos normalmente.");
    } finally {
      setResolvingItemId(null);
    }
    setProcessSuggestion(suggestion);
    setProcessItem(item);
  }

  const processDefaults = processItem
    ? getProcessDefaults(
        processItem,
        accountsQuery.data ?? [],
        cardsQuery.data ?? [],
        processSuggestion,
      )
    : undefined;

  return (
    <section className="app-page project-container min-w-0">
      <PageHeader
        breadcrumbs={[{ label: "Visão geral", href: "/dashboard" }, { label: "Caixa de entrada" }]}
        description="Revise as capturas do Companion antes de transformá-las em lançamentos."
        icon={<Inbox aria-hidden="true" className="size-5" />}
        title="Caixa de entrada"
        actions={
          <Button onClick={() => setRulesOpen(true)} variant="outline">
            <Workflow aria-hidden="true" /> Regras
          </Button>
        }
      />

      <InboxPendingSummary
        isError={query.isError}
        isLoading={query.isLoading}
        summary={query.data?.pendingSummary}
      />

      <Tabs
        className="min-w-0 max-w-full gap-0"
        onValueChange={(value) =>
          onSearchChange({
            status: value as InboxItemStatus,
            page: undefined,
            app: undefined,
            date: undefined,
            rule: undefined,
          })
        }
        value={status}
      >
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:border-border lg:border-b">
          <div className="min-w-0 max-w-full overflow-x-auto">
            <TabsList className="min-w-max lg:border-b-0" variant="line">
              {statuses.map((itemStatus) => (
                <TabsTrigger key={itemStatus} value={itemStatus}>
                  {inboxStatusLabels[itemStatus]}
                  <Badge variant={itemStatus === "pending" ? "secondary" : "outline"}>
                    {query.data?.counts[itemStatus] ?? 0}
                  </Badge>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {query.data ? (
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <InboxFilters
                accounts={accountsQuery.data ?? []}
                cards={cardsQuery.data ?? []}
                notificationDate={notificationDate}
                notificationDates={query.data.notificationDates}
                onRuleChange={(rule) => onSearchChange({ rule, page: undefined })}
                onDateChange={(date) => onSearchChange({ date, page: undefined })}
                onSourceChange={(app) => onSearchChange({ app, date: undefined, page: undefined })}
                sourceAppName={sourceAppName}
                sourceApps={query.data.sourceApps}
                ruleId={ruleId}
                rules={rulesQuery.data?.items.filter((rule) => rule.isActive) ?? []}
              />
              {status !== "pending" ? (
                <Button
                  disabled={query.data.counts[status] === 0}
                  onClick={() => setClearStatus(status)}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  <Trash2 aria-hidden="true" /> Excluir todo este histórico
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </Tabs>

      {query.isLoading ? <InboxLoading /> : null}
      {query.isError ? (
        <Card>
          <CardContent className="grid place-items-center py-12 text-center">
            <p className="font-medium text-sm">Não foi possível carregar as capturas.</p>
            <Button className="mt-3" onClick={() => void query.refetch()} variant="outline">
              <RefreshCw aria-hidden="true" /> Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : null}
      {query.data && !query.isError ? (
        query.data.items.length ? (
          <div className="grid gap-7">
            {groupInboxItemsByDate(query.data.items).map((group) => (
              <section aria-labelledby={`inbox-date-${group.dateKey}`} key={group.dateKey}>
                <div className="mb-2 flex items-center gap-2 text-muted-foreground">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  <h2 className="font-medium text-sm" id={`inbox-date-${group.dateKey}`}>
                    {group.label}
                  </h2>
                  <span className="text-xs tabular-nums">
                    · {group.items.length} {group.items.length === 1 ? "captura" : "capturas"}
                  </span>
                </div>
                <div className="grid gap-3">
                  {group.items.map((item) => {
                    const sourceMatch = getInboxSourceMatch(
                      item.sourceAppName,
                      accountsQuery.data ?? [],
                      cardsQuery.data ?? [],
                    );
                    return (
                      <InboxItemCard
                        item={item}
                        key={item.id}
                        onDelete={() => setDeleteItem(item)}
                        onDetails={() => setDetailsItemId(item.id)}
                        onDiscard={() => void discard(item.id)}
                        onProcess={() => void startProcessing(item)}
                        onRestore={() => void restore(item.id)}
                        processing={
                          (discardMutation.isPending && discardMutation.variables === item.id) ||
                          (restoreMutation.isPending && restoreMutation.variables === item.id) ||
                          resolvingItemId === item.id
                        }
                        sourceMatch={sourceMatch}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <InboxEmpty
            filtered={Boolean(sourceAppName || notificationDate || ruleId)}
            status={status}
          />
        )
      ) : null}

      {query.data && query.data.totalPages > 1 ? (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-3">
          <p className="text-muted-foreground text-sm">
            Página {query.data.page} de {query.data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              disabled={page <= 1}
              onClick={() => onSearchChange({ page: page - 1 })}
              size="sm"
              variant="outline"
            >
              <ArrowLeft aria-hidden="true" /> Anterior
            </Button>
            <Button
              disabled={page >= query.data.totalPages}
              onClick={() => onSearchChange({ page: page + 1 })}
              size="sm"
              variant="outline"
            >
              Próxima <ArrowRight aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}

      <InboxDetailsDialog
        itemId={detailsItemId}
        onOpenChange={(open) => !open && setDetailsItemId(null)}
      />

      {dataSourcesReady ? (
        <TransactionDialog
          accounts={accountsQuery.data}
          cards={cardsQuery.data}
          categories={categoriesQuery.data}
          createDefaults={processDefaults}
          createDescription={`${describeInboxRuleSuggestion(processSuggestion) ?? "Confira os dados capturados e complete o que faltar."} Ao confirmar, será criado um lançamento e a captura sairá das pendentes.`}
          createTitle="Revisar captura"
          defaultType="expense"
          key={processItem?.id ?? "closed"}
          onCreate={async (data) => {
            if (!processItem) throw new Error("inbox_item_not_selected");
            return confirmMutation.mutateAsync({
              id: processItem.id,
              data,
            });
          }}
          onCreated={() => {
            toast.success("Captura confirmada");
          }}
          onOpenChange={(open) => {
            if (!open) {
              setProcessItem(null);
              setProcessSuggestion(null);
            }
          }}
          open={Boolean(processItem)}
          people={peopleQuery.data}
          showTypeSelector
          submitLabel="Confirmar e criar lançamento"
          transaction={null}
        />
      ) : null}

      <InboxRulesDialog
        categories={categoriesQuery.data ?? []}
        onOpenChange={setRulesOpen}
        open={rulesOpen}
        people={peopleQuery.data ?? []}
      />

      <InboxDeleteDialog
        deleteItem={deleteItem}
        setDeleteItem={setDeleteItem}
        deleteMutation={deleteMutation}
        remove={remove}
      />

      <InboxClearDialog
        clearStatus={clearStatus}
        setClearStatus={setClearStatus}
        clearMutation={clearMutation}
        clearAll={clearAll}
        query={query}
      />
    </section>
  );
}
