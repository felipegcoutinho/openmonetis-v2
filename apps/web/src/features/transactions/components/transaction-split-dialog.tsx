import {
  allocateAmountByPercentages,
  analyzeTransactionSplitAllocation,
  calculatePercentageShares,
  rebalanceAmountShare,
  rebalancePercentageShare,
  splitAmountEqually,
} from "@openmonetis/domain/transactions";
import type { PersonOutput } from "@openmonetis/validators/people";
import { useQuery } from "@tanstack/react-query";
import {
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Link2,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { CurrentUserBadge } from "@/components/current-user-badge";
import { MoneyValue } from "@/components/money-value";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { personConnectionsQueryOptions } from "@/features/person-connections/person-connections.queries";
import { cn } from "@/lib/utils";

type SplitFormShare = { personId: string; amount: string };
type SplitMode = "amount" | "percentage";
type PercentageFormShare = { personId: string; percentage: string };

const percentageFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function createEqualShares(personIds: string[], total: number): SplitFormShare[] {
  const amounts = splitAmountEqually(total, personIds.length);
  return personIds.map((personId, index) => ({
    personId,
    amount: getAllocationValue(amounts, index).toFixed(2),
  }));
}

function parsePercentage(value: string) {
  const percentage = Number(value.replace(",", "."));
  return Number.isFinite(percentage) ? percentage : 0;
}

function formatPercentageInput(value: number) {
  return percentageFormatter.format(value);
}

function normalizePercentageInput(value: string) {
  const normalized = value.replace(".", ",").replace(/[^\d,]/g, "");
  const [integer = "", ...decimalParts] = normalized.split(",");
  if (!decimalParts.length) return integer;
  return `${integer},${decimalParts.join("").slice(0, 2)}`;
}

function getAllocationValue(values: readonly number[], index: number) {
  const value = values[index];
  if (value === undefined) throw new Error("Incomplete split allocation");
  return value;
}

function SplitAvatarStack({
  people,
  shares,
}: {
  people: PersonOutput[];
  shares: SplitFormShare[];
}) {
  return (
    <span className="inline-flex shrink-0 -space-x-2 transition-transform group-hover:scale-105">
      {shares.slice(0, 3).map((share) => {
        const person = people.find((item) => item.id === share.personId);
        return person ? (
          <Avatar key={share.personId} showBorder={false} size="sm">
            <AvatarImage alt={`Avatar de ${person.name}`} src={person.avatarUrl ?? undefined} />
            <AvatarFallback>{person.name[0]}</AvatarFallback>
          </Avatar>
        ) : null;
      })}
      {shares.length > 3 ? (
        <span className="relative flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
          <span aria-hidden="true">+{shares.length - 3}</span>
          <span className="sr-only">Mais {shares.length - 3} pessoas</span>
        </span>
      ) : null}
    </span>
  );
}

function createPercentageDraft(shares: SplitFormShare[], total: number): PercentageFormShare[] {
  if (!shares.length || total <= 0) return [];
  const percentages = calculatePercentageShares(
    total,
    shares.map((share) => share.amount),
  );
  return shares.map((share, index) => ({
    personId: share.personId,
    percentage: formatPercentageInput(getAllocationValue(percentages, index)),
  }));
}

export function TransactionSplitDialog({
  amount,
  disabled,
  onChange,
  people,
  primaryPersonId,
  value,
}: {
  amount: string;
  disabled: boolean;
  onChange: (shares: SplitFormShare[]) => void;
  people: PersonOutput[];
  primaryPersonId: string;
  value: SplitFormShare[];
}) {
  const connections = useQuery(personConnectionsQueryOptions());
  const [open, setOpen] = useState(false);
  const [removalOpen, setRemovalOpen] = useState(false);
  const [draft, setDraft] = useState<SplitFormShare[]>(value);
  const [percentageDraft, setPercentageDraft] = useState<PercentageFormShare[]>([]);
  const [splitMode, setSplitMode] = useState<SplitMode>("amount");
  const [lastEditedPersonId, setLastEditedPersonId] = useState<string | null>(null);
  const [redistributionSelection, setRedistributionSelection] = useState<string | null>(null);
  const total = Number(amount) || 0;
  const committedAllocation = analyzeTransactionSplitAllocation({
    totalAmount: total,
    amounts: value.map((share) => share.amount),
    mode: "amount",
  });
  const isDivided = committedAllocation.canSave;
  const activeConnectedPersonIds = new Set(
    (connections.data ?? [])
      .filter((connection) => connection.perspective === "owner" && connection.status === "active")
      .flatMap((connection) => (connection.personId ? [connection.personId] : [])),
  );
  const connectedShares = value.filter((share) => activeConnectedPersonIds.has(share.personId));
  const connectedDraftShares = draft.filter((share) =>
    activeConnectedPersonIds.has(share.personId),
  );
  const cardDisabled = disabled || people.length < 2 || !primaryPersonId || total <= 0;

  function openEditor() {
    const initialDraft = value.length ? value : createEqualShares([primaryPersonId], total);
    setDraft(initialDraft);
    setPercentageDraft(createPercentageDraft(initialDraft, total));
    setLastEditedPersonId(null);
    setRedistributionSelection(null);
    setOpen(true);
  }

  function applyEqualSplit(shares = draft) {
    if (!shares.length) {
      setDraft([]);
      setPercentageDraft([]);
      setLastEditedPersonId(null);
      setRedistributionSelection(null);
      return;
    }
    const personIds = shares.map((share) => share.personId);
    if (splitMode === "percentage") {
      const percentages = splitAmountEqually(100, personIds.length);
      const amounts = allocateAmountByPercentages(total, percentages);
      setPercentageDraft(
        personIds.map((personId, index) => ({
          personId,
          percentage: formatPercentageInput(getAllocationValue(percentages, index)),
        })),
      );
      setDraft(
        personIds.map((personId, index) => ({
          personId,
          amount: getAllocationValue(amounts, index).toFixed(2),
        })),
      );
    } else {
      const nextDraft = createEqualShares(personIds, total);
      setDraft(nextDraft);
      setPercentageDraft(createPercentageDraft(nextDraft, total));
    }
    setLastEditedPersonId(null);
    setRedistributionSelection(null);
  }

  function togglePerson(personId: string, checked: boolean) {
    const nextDraft = checked
      ? [...draft, { personId, amount: "" }]
      : draft.filter((share) => share.personId !== personId);

    applyEqualSplit(nextDraft);
  }

  function updateAmount(personId: string, nextAmount: string) {
    const numericAmount = Number(nextAmount);
    if (
      draft.length === 2 &&
      Number.isFinite(numericAmount) &&
      numericAmount >= 0 &&
      numericAmount <= total
    ) {
      const totalCents = Math.round(total * 100);
      const editedCents = Math.round(numericAmount * 100);
      const nextDraft = draft.map((share) => ({
        ...share,
        amount:
          share.personId === personId
            ? (editedCents / 100).toFixed(2)
            : ((totalCents - editedCents) / 100).toFixed(2),
      }));
      setDraft(nextDraft);
      setPercentageDraft(createPercentageDraft(nextDraft, total));
      setLastEditedPersonId(null);
      setRedistributionSelection(null);
      return;
    }

    const nextDraft = draft.map((share) =>
      share.personId === personId ? { ...share, amount: nextAmount } : share,
    );
    setDraft(nextDraft);
    setPercentageDraft(createPercentageDraft(nextDraft, total));
    setLastEditedPersonId(personId);
    setRedistributionSelection(null);
  }

  function updatePercentage(personId: string, nextValue: string) {
    const nextPercentageDraft = percentageDraft.map((share) =>
      share.personId === personId
        ? { ...share, percentage: normalizePercentageInput(nextValue) }
        : share,
    );
    const numericPercentage = parsePercentage(nextValue);
    if (
      percentageDraft.length === 2 &&
      nextValue.trim() &&
      numericPercentage >= 0 &&
      numericPercentage <= 100
    ) {
      const balancedPercentages = nextPercentageDraft.map((share) => ({
        ...share,
        percentage:
          share.personId === personId
            ? formatPercentageInput(numericPercentage)
            : formatPercentageInput(100 - numericPercentage),
      }));
      const amounts = allocateAmountByPercentages(
        total,
        balancedPercentages.map((share) => parsePercentage(share.percentage)),
      );
      setPercentageDraft(balancedPercentages);
      setDraft(
        balancedPercentages.map((share, index) => ({
          personId: share.personId,
          amount: getAllocationValue(amounts, index).toFixed(2),
        })),
      );
      setLastEditedPersonId(null);
      setRedistributionSelection(null);
      return;
    }

    const amounts = allocateAmountByPercentages(
      total,
      nextPercentageDraft.map((share) => Math.min(100, parsePercentage(share.percentage))),
    );
    setPercentageDraft(nextPercentageDraft);
    setDraft(
      nextPercentageDraft.map((share, index) => ({
        personId: share.personId,
        amount: getAllocationValue(amounts, index).toFixed(2),
      })),
    );
    setLastEditedPersonId(personId);
    setRedistributionSelection(null);
  }

  function changeSplitMode(mode: SplitMode) {
    setSplitMode(mode);
    setRedistributionSelection(null);
  }

  function redistributeDifference(personId: string) {
    const targetIndex = draft.findIndex((share) => share.personId === personId);

    if (splitMode === "percentage") {
      const percentages = rebalancePercentageShare(
        percentageDraft.map((share) => parsePercentage(share.percentage)),
        targetIndex,
      );
      const amounts = allocateAmountByPercentages(total, percentages);
      setPercentageDraft(
        percentageDraft.map((share, index) => ({
          ...share,
          percentage: formatPercentageInput(getAllocationValue(percentages, index)),
        })),
      );
      setDraft(
        draft.map((share, index) => ({
          ...share,
          amount: getAllocationValue(amounts, index).toFixed(2),
        })),
      );
    } else {
      const amounts = rebalanceAmountShare(
        total,
        draft.map((share) => share.amount),
        targetIndex,
      );
      const nextDraft = draft.map((share, index) => ({
        ...share,
        amount: getAllocationValue(amounts, index).toFixed(2),
      }));
      setDraft(nextDraft);
      setPercentageDraft(createPercentageDraft(nextDraft, total));
    }

    setRedistributionSelection(null);
  }

  function save() {
    onChange(draft);
    setOpen(false);
  }

  const allocation = analyzeTransactionSplitAllocation({
    totalAmount: total,
    amounts: draft.map((share) => share.amount),
    percentages: percentageDraft.map((share) => parsePercentage(share.percentage)),
    mode: splitMode,
  });
  const {
    allocationExceeded,
    canSave,
    differenceCents,
    distributedPercentage,
    hasAllocationDifference,
    hasAllocationIssue,
    hasInvalidAllocation,
    percentageDifferenceBasisPoints,
  } = allocation;
  const disabledReason =
    people.length < 2
      ? "Cadastre outra pessoa para dividir o lançamento."
      : !primaryPersonId
        ? "Selecione a pessoa responsável pelo lançamento."
        : total <= 0
          ? "Informe o valor do lançamento antes de dividir."
          : null;
  const redistributionCandidates = draft.filter((share, index) => {
    if (share.personId === lastEditedPersonId) return false;
    if (allocation.differenceIsMissing) return true;
    return splitMode === "percentage"
      ? parsePercentage(percentageDraft[index]?.percentage ?? "") > 0.01
      : getAllocationValue(allocation.amountCents, index) > 1;
  });
  const showRedistribution =
    Boolean(lastEditedPersonId) &&
    draft.length >= 2 &&
    hasAllocationDifference &&
    !hasInvalidAllocation &&
    redistributionCandidates.length > 0;
  const selectedRedistributionPersonId = redistributionCandidates.some(
    (share) => share.personId === redistributionSelection,
  )
    ? redistributionSelection
    : (redistributionCandidates[0]?.personId ?? null);
  const selectedRedistributionPerson = people.find(
    (person) => person.id === selectedRedistributionPersonId,
  );

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <section
        className={cn(
          "group rounded-lg border border-input bg-popover transition-all focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
          !cardDisabled && "hover:border-brand-strong/40 hover:bg-accent/40",
          isDivided && "border-brand-strong/20 bg-brand/5",
          cardDisabled && "bg-muted/30",
        )}
      >
        <div className="flex items-center">
          <button
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-3 text-left outline-none",
              !cardDisabled && "cursor-pointer",
            )}
            disabled={cardDisabled}
            onClick={openEditor}
            type="button"
          >
            {isDivided ? (
              <SplitAvatarStack people={people} shares={value} />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand/10 text-brand-strong transition-transform group-hover:scale-105">
                <Users className="size-4" />
              </span>
            )}
            <span className="min-w-0 flex-1 space-y-1">
              <span className="block truncate font-medium text-sm">
                {isDivided ? "Divisão do lançamento" : "Dividir lançamento"}
              </span>
              {isDivided ? (
                <span className="block truncate text-muted-foreground text-xs">
                  Total distribuído:{" "}
                  <MoneyValue amount={committedAllocation.allocatedCents / 100} />
                  <span aria-hidden="true"> · </span>
                  {value.length} pessoas
                </span>
              ) : (
                <span className="block text-muted-foreground text-xs">
                  {disabledReason ?? "Atribua partes do valor a duas ou mais pessoas."}
                </span>
              )}
            </span>
            <ChevronRight
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground"
            />
          </button>
          {isDivided ? (
            <>
              <span aria-hidden="true" className="h-6 w-px shrink-0 bg-border" />
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      aria-label="Remover divisão"
                      className="mx-0.5 size-11 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => setRemovalOpen(true)}
                      size="icon-sm"
                      type="button"
                      variant="ghost"
                    />
                  }
                >
                  <Trash2 aria-hidden="true" className="size-3.5" />
                </TooltipTrigger>
                <TooltipContent>Remover divisão</TooltipContent>
              </Tooltip>
            </>
          ) : null}
        </div>
        {connectedShares.length > 0 ? (
          <p className="mx-3 mb-2.5 flex items-center gap-1.5 rounded-md bg-brand/5 px-2 py-1.5 text-brand-strong text-xs">
            <Link2 aria-hidden="true" className="size-3.5" />
            {connectedShares.length === 1
              ? "1 pessoa conectada receberá este gasto para revisar."
              : `${connectedShares.length} pessoas conectadas receberão este gasto para revisar.`}
          </p>
        ) : null}
      </section>

      <AlertDialog onOpenChange={setRemovalOpen} open={removalOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover divisão?</AlertDialogTitle>
            <AlertDialogDescription>
              As partes atribuídas às pessoas serão removidas deste lançamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange([]);
                setRemovalOpen(false);
              }}
              variant="destructive"
            >
              Remover divisão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dividir lançamento</DialogTitle>
          <DialogDescription>
            Selecione os participantes e distribua o valor total do lançamento.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 -mt-4 space-y-4 overflow-y-auto pr-1">
          <Tabs
            aria-label="Forma de divisão"
            className="gap-0"
            onValueChange={(value) => changeSplitMode(value as SplitMode)}
            value={splitMode}
          >
            <TabsList variant="line">
              <TabsTrigger value="amount">Valor (R$)</TabsTrigger>
              <TabsTrigger value="percentage">Percentual (%)</TabsTrigger>
            </TabsList>
          </Tabs>

          {connectedDraftShares.length > 0 ? (
            <section aria-label="Envios para revisão" className="grid gap-2">
              <p className="font-medium text-muted-foreground text-xs">Envios para revisão</p>
              {connectedDraftShares.map((share) => {
                const person = people.find((candidate) => candidate.id === share.personId);
                return person ? (
                  <p
                    className="flex items-center gap-1.5 rounded-md bg-brand/5 px-2 py-1.5 text-brand-strong text-xs"
                    key={share.personId}
                  >
                    <Link2 aria-hidden="true" className="size-3.5" />
                    {person.name} receberá <MoneyValue amount={Number(share.amount)} /> em Gastos
                    Compartilhados.
                  </p>
                ) : null;
              })}
            </section>
          ) : null}

          <div
            className={cn(
              "space-y-3 rounded-lg border p-4",
              canSave
                ? "border-success/20 bg-success/5"
                : hasAllocationIssue
                  ? "border-destructive/30 bg-destructive/5"
                  : "border-info/20 bg-info/5",
            )}
          >
            <div>
              <p className="text-muted-foreground text-xs">Total do lançamento</p>
              <MoneyValue amount={total} className="font-semibold text-lg" />
            </div>

            <Progress
              aria-label={`${Math.round(distributedPercentage)}% do valor distribuído`}
              indicatorClassName={cn(
                canSave && "bg-success",
                !canSave && allocationExceeded && "bg-destructive",
                !canSave && !allocationExceeded && "bg-info",
              )}
              value={distributedPercentage}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 font-medium",
                  canSave ? "text-success" : hasAllocationIssue ? "text-destructive" : "text-info",
                )}
              >
                {canSave ? (
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                ) : (
                  <CircleAlert aria-hidden="true" className="size-4" />
                )}
                {draft.length < 2 ? (
                  "Selecione pelo menos mais uma pessoa"
                ) : hasInvalidAllocation ? (
                  splitMode === "percentage" ? (
                    "Informe um percentual entre 0% e 100% para cada pessoa"
                  ) : (
                    "Informe um valor para cada pessoa"
                  )
                ) : splitMode === "percentage" && percentageDifferenceBasisPoints > 0 ? (
                  `Falta distribuir ${formatPercentageInput(percentageDifferenceBasisPoints / 100)}%`
                ) : splitMode === "percentage" && percentageDifferenceBasisPoints < 0 ? (
                  `Excedeu ${formatPercentageInput(Math.abs(percentageDifferenceBasisPoints) / 100)}%`
                ) : differenceCents > 0 ? (
                  <>
                    Falta distribuir <MoneyValue amount={differenceCents / 100} />
                  </>
                ) : differenceCents < 0 ? (
                  <>
                    Excedeu <MoneyValue amount={Math.abs(differenceCents) / 100} />
                  </>
                ) : (
                  "Valor totalmente distribuído"
                )}
              </span>
              <span className="text-muted-foreground">
                {splitMode === "percentage" ? (
                  `Distribuído: ${formatPercentageInput(allocation.percentageBasisPoints / 100)}%`
                ) : (
                  <>
                    Distribuído: <MoneyValue amount={allocation.allocatedCents / 100} />
                  </>
                )}
              </span>
            </div>
          </div>

          {showRedistribution ? (
            <div className="grid gap-3 rounded-lg border border-info/20 bg-info/5 p-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-center">
              <div>
                <p className="font-medium text-sm">Redistribuir diferença</p>
                <p className="text-muted-foreground text-xs">
                  {allocation.differenceIsMissing
                    ? "Escolha quem deve receber o valor que falta."
                    : "Escolha de quem o valor excedente deve ser descontado."}
                </p>
              </div>
              <div className="flex min-w-0 gap-2">
                <Select
                  onValueChange={(value) => setRedistributionSelection(value)}
                  value={selectedRedistributionPersonId}
                >
                  <SelectTrigger
                    className="min-w-0 flex-1"
                    aria-label="Pessoa que absorverá a diferença"
                  >
                    <SelectValue placeholder="Selecionar pessoa">
                      {selectedRedistributionPerson ? (
                        <>
                          <Avatar size="sm">
                            <AvatarImage
                              alt={`Avatar de ${selectedRedistributionPerson.name}`}
                              src={selectedRedistributionPerson.avatarUrl ?? undefined}
                            />
                            <AvatarFallback>{selectedRedistributionPerson.name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{selectedRedistributionPerson.name}</span>
                        </>
                      ) : null}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end">
                    {redistributionCandidates.map((share) => {
                      const person = people.find((item) => item.id === share.personId);
                      return person ? (
                        <SelectItem key={person.id} value={person.id}>
                          <Avatar size="sm">
                            <AvatarImage
                              alt={`Avatar de ${person.name}`}
                              src={person.avatarUrl ?? undefined}
                            />
                            <AvatarFallback>{person.name[0]}</AvatarFallback>
                          </Avatar>
                          <span>{person.name}</span>
                        </SelectItem>
                      ) : null;
                    })}
                  </SelectContent>
                </Select>
                <Button
                  disabled={!selectedRedistributionPersonId}
                  onClick={() => {
                    if (selectedRedistributionPersonId) {
                      redistributeDifference(selectedRedistributionPersonId);
                    }
                  }}
                  type="button"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          ) : null}

          <section className="space-y-2" aria-labelledby="split-people-title">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="font-medium text-sm" id="split-people-title">
                  Pessoas
                </h3>
                <p className="text-muted-foreground text-xs">
                  {splitMode === "percentage"
                    ? "Selecione pelo menos duas pessoas. A soma dos percentuais deve ser 100%."
                    : "Selecione pelo menos duas pessoas. O valor é dividido igualmente ao selecionar."}
                </p>
              </div>
              <Badge variant="secondary">
                {draft.length} {draft.length === 1 ? "selecionada" : "selecionadas"}
              </Badge>
            </div>

            <div className="space-y-2">
              {people.map((person) => {
                const share = draft.find((item) => item.personId === person.id);
                const percentageShare = percentageDraft.find((item) => item.personId === person.id);
                const percentageValue = percentageShare?.percentage ?? "";
                const isPrimary = person.id === primaryPersonId;
                const isSelected = Boolean(share);

                return (
                  <div
                    className={cn(
                      "grid items-center gap-3 rounded-lg border p-3 transition-colors sm:grid-cols-[minmax(0,1fr)_9rem]",
                      isSelected
                        ? "border-brand-strong/20 bg-brand/5"
                        : "border-border bg-muted/20 hover:bg-muted/40",
                    )}
                    key={person.id}
                  >
                    <label
                      className="flex min-w-0 cursor-pointer items-center gap-2.5"
                      htmlFor={`split-person-${person.id}`}
                    >
                      <Checkbox
                        aria-label={`Incluir ${person.name} na divisão`}
                        checked={isSelected}
                        id={`split-person-${person.id}`}
                        onCheckedChange={(checked) => togglePerson(person.id, Boolean(checked))}
                      />
                      <Avatar size="sm">
                        <AvatarImage
                          alt={`Avatar de ${person.name}`}
                          src={person.avatarUrl ?? undefined}
                        />
                        <AvatarFallback>{person.name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                        <span className="truncate">{person.name}</span>
                        {person.role === "admin" ? (
                          <CurrentUserBadge />
                        ) : activeConnectedPersonIds.has(person.id) ? (
                          <Badge variant="secondary">
                            <Link2 aria-hidden="true" /> Conta conectada
                          </Badge>
                        ) : isPrimary ? (
                          <span
                            className="shrink-0 text-info"
                            title="Pessoa principal do lançamento"
                          >
                            <BadgeCheck aria-hidden="true" className="size-4" />
                            <span className="sr-only">Pessoa principal do lançamento</span>
                          </span>
                        ) : null}
                      </span>
                    </label>
                    {share ? (
                      splitMode === "percentage" ? (
                        <div className="space-y-1">
                          <div className="relative">
                            <Input
                              aria-invalid={
                                parsePercentage(percentageValue) <= 0 ||
                                parsePercentage(percentageValue) > 100
                              }
                              aria-label={`Percentual de ${person.name}`}
                              className="pr-8 text-right tabular-nums"
                              inputMode="decimal"
                              maxLength={6}
                              onChange={(event) => updatePercentage(person.id, event.target.value)}
                              placeholder="0"
                              type="text"
                              value={percentageValue}
                            />
                            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-muted-foreground text-sm">
                              %
                            </span>
                          </div>
                          <p className="text-right text-muted-foreground text-xs">
                            <MoneyValue amount={Number(share.amount) || 0} />
                          </p>
                        </div>
                      ) : (
                        <CurrencyInput
                          aria-label={`Valor de ${person.name}`}
                          onValueChange={(nextAmount) => updateAmount(person.id, nextAmount)}
                          placeholder="R$ 0,00"
                          value={share.amount}
                        />
                      )
                    ) : (
                      <div className="hidden h-9 sm:block" />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="shrink-0">
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancelar
          </Button>
          <Button disabled={!canSave} onClick={save} type="button">
            Salvar divisão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
