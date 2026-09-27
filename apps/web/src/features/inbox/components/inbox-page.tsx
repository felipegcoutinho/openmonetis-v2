import type { InboxClearableStatus, InboxItemStatus } from "@openmonetis/domain/inbox";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { InboxItemSummaryOutput, InboxPageOutput } from "@openmonetis/validators/inbox";
import type { InboxRuleSuggestionOutput } from "@openmonetis/validators/inbox-rules";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import {
  ArchiveX,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleCheck,
  ClipboardPen,
  CreditCard,
  Eye,
  Inbox,
  Landmark,
  RefreshCw,
  RotateCcw,
  Trash2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { FinancialSummaryHeader } from "@/components/financial-summary-header";
import { MoneyValue } from "@/components/money-value";
import { PageHeader } from "@/components/page-header";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import type { TransactionCreateDefaults } from "@/features/transactions/components/transaction-form.validation";
import {
  useClearInboxItemsMutation,
  useConfirmInboxItemMutation,
  useDeleteInboxItemMutation,
  useDiscardInboxItemMutation,
  useRestoreInboxItemMutation,
} from "../inbox.mutations";
import {
  formatInboxAmount,
  formatInboxTime,
  getInboxItemTitle,
  getInboxPurchaseDate,
  getInboxSourceMatch,
  groupInboxItemsByDate,
  type InboxSourceMatch,
  inboxStatusLabels,
} from "../inbox.presentation";
import { inboxItemQueryOptions, inboxItemsQueryOptions } from "../inbox.queries";
import { InboxFilters } from "./inbox-filters";
import { InboxSourceLogo } from "./inbox-source-logo";

const statuses: InboxItemStatus[] = ["pending", "processed", "discarded"];

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
    <section className="app-page project-container">
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
        className="gap-0"
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:border-border lg:border-b">
          <div className="overflow-x-auto">
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
            <div className="flex flex-wrap items-center gap-2">
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

      <AlertDialog onOpenChange={(open) => !open && setDeleteItem(null)} open={Boolean(deleteItem)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              O pré-lançamento será removido. Um lançamento já confirmado não será excluído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteItem) void remove(deleteItem);
              }}
              variant="destructive"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open && !clearMutation.isPending) setClearStatus(null);
        }}
        open={Boolean(clearStatus)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {clearStatus ? (query.data?.counts[clearStatus] ?? 0) : 0}{" "}
              {clearStatus === "processed" ? "processadas" : "descartadas"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todas as capturas desta aba serão excluídas, inclusive as que não aparecem nos filtros
              atuais. Lançamentos já confirmados serão mantidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearMutation.isPending}
              onClick={() => void clearAll()}
              variant="destructive"
            >
              {clearMutation.isPending ? "Excluindo..." : "Excluir tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function InboxPendingSummary({
  isError,
  isLoading,
  summary,
}: {
  isError: boolean;
  isLoading: boolean;
  summary: InboxPageOutput["pendingSummary"] | undefined;
}) {
  return (
    <FinancialSummaryHeader
      details={<InboxPendingSourceList isError={isError} isLoading={isLoading} summary={summary} />}
      eyebrow="Caixa de entrada"
      identity={
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-current/10">
          <Inbox aria-hidden="true" className="size-6" />
        </span>
      }
      metrics={[]}
      primaryLabel="Valor das capturas a revisar"
      primaryValue={
        isLoading ? (
          <Skeleton className="h-12 w-52 bg-current/15 before:via-current/20" />
        ) : isError ? (
          <span className="text-xl">Indisponível</span>
        ) : (
          <MoneyValue amount={summary?.totalAmount ?? 0} />
        )
      }
      subtitle={
        isLoading
          ? "Calculando as capturas pendentes"
          : `${summary?.pendingCount ?? 0} ${
              summary?.pendingCount === 1
                ? "captura aguardando revisão"
                : "capturas aguardando revisão"
            }`
      }
      title="Pendências capturadas"
      variant="soft"
    />
  );
}

function InboxPendingSourceList({
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

function InboxPendingSourceRow({
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

function InboxPendingSourceIcon({
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

function InboxItemCard({
  item,
  onDelete,
  onDetails,
  onDiscard,
  onProcess,
  onRestore,
  processing,
  sourceMatch,
}: {
  item: InboxItemSummaryOutput;
  onDelete: () => void;
  onDetails: () => void;
  onDiscard: () => void;
  onProcess: () => void;
  onRestore: () => void;
  processing: boolean;
  sourceMatch: InboxSourceMatch | null;
}) {
  const amount = formatInboxAmount(item.parsedAmount);
  const suggestionQuery = useQuery({
    ...inboxRuleSuggestionQueryOptions(item.id),
    enabled: item.status === "pending",
  });
  return (
    <Card className="py-0">
      <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
        <InboxSourceLogo className="size-11" match={sourceMatch} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate font-medium">
              {getInboxItemTitle(item)}{" "}
              <span className="font-normal text-muted-foreground text-xs">
                · {formatInboxTime(item.notificationTimestamp)}
              </span>
            </p>
            {sourceMatch ? (
              <Badge variant="secondary">
                {sourceMatch.kind === "card" ? "Cartão" : "Conta"} · {sourceMatch.name}
              </Badge>
            ) : (
              <Badge variant="secondary">{item.sourceAppName ?? "App financeiro"}</Badge>
            )}
            {item.status === "pending"
              ? suggestionQuery.data?.appliedRules.map((rule) => (
                  <Badge
                    className="max-w-full gap-1"
                    key={rule.id}
                    title={`Regra aplicada: ${rule.name}`}
                    variant="outline"
                  >
                    <Workflow aria-hidden="true" className="size-3 shrink-0" />
                    <span className="truncate">Regra · {rule.name}</span>
                  </Badge>
                ))
              : null}
          </div>
          <p className="mt-2 line-clamp-2 wrap-break-word text-muted-foreground text-sm leading-relaxed">
            {item.originalText}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3 self-center">
          {amount ? <p className="font-semibold tabular-nums">{amount}</p> : null}
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger
                aria-label="Ver detalhes"
                onClick={onDetails}
                render={
                  <Button
                    className="text-muted-foreground hover:text-foreground"
                    size="icon-sm"
                    variant="ghost"
                  />
                }
              >
                <Eye aria-hidden="true" />
              </TooltipTrigger>
              <TooltipContent>Ver detalhes</TooltipContent>
            </Tooltip>
            {item.status === "pending" ? (
              <>
                <Tooltip>
                  <TooltipTrigger
                    aria-label="Descartar captura"
                    disabled={processing}
                    onClick={onDiscard}
                    render={
                      <Button
                        className="text-muted-foreground hover:text-destructive"
                        size="icon-sm"
                        variant="ghost"
                      />
                    }
                  >
                    <ArchiveX aria-hidden="true" />
                  </TooltipTrigger>
                  <TooltipContent>Descartar</TooltipContent>
                </Tooltip>
                <Button disabled={processing} onClick={onProcess} size="sm">
                  <ClipboardPen aria-hidden="true" /> Revisar
                </Button>
              </>
            ) : item.status === "discarded" ? (
              <>
                <Button disabled={processing} onClick={onRestore} size="sm" variant="outline">
                  <RotateCcw aria-hidden="true" /> Restaurar
                </Button>
                <Button aria-label="Excluir" onClick={onDelete} size="icon-sm" variant="ghost">
                  <Trash2 aria-hidden="true" />
                </Button>
              </>
            ) : (
              <Button aria-label="Excluir" onClick={onDelete} size="icon-sm" variant="ghost">
                <Trash2 aria-hidden="true" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function InboxDetailsDialog({
  itemId,
  onOpenChange,
}: {
  itemId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const query = useQuery(inboxItemQueryOptions(itemId ?? ""));
  const item = query.data;
  return (
    <Dialog onOpenChange={onOpenChange} open={Boolean(itemId)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Detalhes da captura</DialogTitle>
          <DialogDescription>
            Conteúdo original enviado pelo Companion. Confirme os dados antes de usar.
          </DialogDescription>
        </DialogHeader>
        {query.isLoading ? <Skeleton className="h-40" /> : null}
        {query.isError ? (
          <p className="text-destructive text-sm">Não foi possível carregar os detalhes.</p>
        ) : null}
        {item && !query.isError ? (
          <dl className="grid gap-4">
            <div>
              <dt className="font-medium text-muted-foreground text-xs">Origem</dt>
              <dd className="mt-1 text-sm">{item.sourceAppName ?? item.sourceApp}</dd>
            </div>
            {item.originalTitle ? (
              <div>
                <dt className="font-medium text-muted-foreground text-xs">Título</dt>
                <dd className="mt-1 wrap-break-word text-sm">{item.originalTitle}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-medium text-muted-foreground text-xs">Texto da notificação</dt>
              <dd className="mt-1 rounded-lg border bg-muted/30 p-3 wrap-break-word text-sm leading-relaxed">
                {item.originalText}
              </dd>
            </div>
          </dl>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function InboxEmpty({ filtered, status }: { filtered: boolean; status: InboxItemStatus }) {
  if (filtered) {
    return (
      <Card>
        <CardContent className="grid place-items-center py-16 text-center">
          <p className="font-medium">Nenhuma captura com estes filtros</p>
          <p className="mt-1 text-muted-foreground text-sm">
            Remova os filtros de aplicativo ou data para ampliar a busca.
          </p>
        </CardContent>
      </Card>
    );
  }
  const copy = {
    pending: [
      "Nada para revisar",
      "Conecte o Companion em Ajustes para receber capturas. Se já está conectado, suas próximas capturas aparecerão aqui.",
    ],
    processed: [
      "Nenhuma captura confirmada",
      "Itens confirmados ficam disponíveis neste histórico.",
    ],
    discarded: ["Nenhum item descartado", "Capturas ignoradas podem ser restauradas por aqui."],
  }[status];
  return (
    <Card>
      <CardContent className="grid place-items-center py-16 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-success/10 text-success">
          <CircleCheck aria-hidden="true" className="size-5" />
        </span>
        <p className="mt-3 font-medium">{copy[0]}</p>
        <p className="mt-1 text-muted-foreground text-sm">{copy[1]}</p>
      </CardContent>
    </Card>
  );
}

function InboxLoading() {
  return (
    <div className="grid gap-3" role="status" aria-label="Carregando pré-lançamentos">
      {["first", "second", "third"].map((key) => (
        <Skeleton className="h-24" key={key} />
      ))}
    </div>
  );
}

function getProcessDefaults(
  item: InboxItemSummaryOutput,
  accounts: AccountOutput[],
  cards: CardOutput[],
  suggestion: InboxRuleSuggestionOutput | null,
): TransactionCreateDefaults {
  const sourceMatch = getInboxSourceMatch(item.sourceAppName, accounts, cards);
  const matchedCardId = sourceMatch?.kind === "card" ? sourceMatch.id : undefined;
  const matchedAccountId = sourceMatch?.kind === "account" ? sourceMatch.id : undefined;
  const fallbackAccountId = accounts.find((candidate) => !candidate.isArchived)?.id;

  return {
    name: item.parsedName ?? "",
    amount: item.parsedAmount === null ? "" : String(item.parsedAmount),
    purchaseDate: getInboxPurchaseDate(item.notificationTimestamp),
    paymentMethod: matchedCardId ? "credit_card" : "pix",
    cardId: matchedCardId,
    accountId: matchedCardId ? undefined : (matchedAccountId ?? fallbackAccountId),
    categoryId: suggestion?.categoryId ?? undefined,
    personId: suggestion?.personId ?? undefined,
  };
}
