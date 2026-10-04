import { Link2 } from "lucide-react";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import { MoneyValue } from "@/components/money-value";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTransactionSplitEditor } from "../useTransactionSplitEditor";
import type { SplitMode, TransactionSplitDialogProps } from "./transaction-split-dialog.types";
import { TransactionSplitParticipants } from "./transaction-split-participants";
import { TransactionSplitRedistribution } from "./transaction-split-redistribution";
import { TransactionSplitRemoveDialog } from "./transaction-split-remove-dialog";
import { TransactionSplitSummary } from "./transaction-split-summary";
import { TransactionSplitTrigger } from "./transaction-split-trigger";

export type { TransactionSplitDialogProps } from "./transaction-split-dialog.types";

export function TransactionSplitDialog({
  amount,
  disabled,
  onChange,
  people,
  primaryPersonId,
  value,
}: TransactionSplitDialogProps) {
  const {
    open,
    setOpen,
    removalOpen,
    setRemovalOpen,
    draft,
    percentageDraft,
    splitMode,
    setRedistributionSelection,
    total,
    committedAllocation,
    isDivided,
    activeConnectedPersonIds,
    connectedShares,
    connectedDraftShares,
    cardDisabled,
    openEditor,
    togglePerson,
    updateAmount,
    updatePercentage,
    changeSplitMode,
    redistributeDifference,
    save,
    allocation,
    allocationExceeded,
    canSave,
    differenceCents,
    distributedPercentage,
    hasAllocationIssue,
    hasInvalidAllocation,
    percentageDifferenceBasisPoints,
    disabledReason,
    redistributionCandidates,
    showRedistribution,
    selectedRedistributionPersonId,
    selectedRedistributionPerson,
  } = useTransactionSplitEditor({ amount, disabled, onChange, people, primaryPersonId, value });
  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <TransactionSplitTrigger
        value={value}
        open={open}
        setRemovalOpen={setRemovalOpen}
        committedAllocation={committedAllocation}
        isDivided={isDivided}
        connectedShares={connectedShares}
        cardDisabled={cardDisabled}
        openEditor={openEditor}
        disabledReason={disabledReason}
        people={people}
      />

      <TransactionSplitRemoveDialog
        removalOpen={removalOpen}
        setRemovalOpen={setRemovalOpen}
        onChange={onChange}
      />

      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dividir lançamento</DialogTitle>
          <DialogDescription>
            Selecione os participantes e distribua o valor total do lançamento.
          </DialogDescription>
        </DialogHeader>

        <div data-mobile-form-body className="min-h-0 -mt-4 space-y-4 overflow-y-auto pr-1">
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

          <TransactionSplitSummary
            draft={draft}
            splitMode={splitMode}
            total={total}
            allocation={allocation}
            allocationExceeded={allocationExceeded}
            canSave={canSave}
            differenceCents={differenceCents}
            distributedPercentage={distributedPercentage}
            hasAllocationIssue={hasAllocationIssue}
            hasInvalidAllocation={hasInvalidAllocation}
            percentageDifferenceBasisPoints={percentageDifferenceBasisPoints}
          />

          <TransactionSplitRedistribution
            setRedistributionSelection={setRedistributionSelection}
            redistributeDifference={redistributeDifference}
            allocation={allocation}
            redistributionCandidates={redistributionCandidates}
            showRedistribution={showRedistribution}
            selectedRedistributionPersonId={selectedRedistributionPersonId}
            selectedRedistributionPerson={selectedRedistributionPerson}
            people={people}
          />

          <TransactionSplitParticipants
            draft={draft}
            percentageDraft={percentageDraft}
            splitMode={splitMode}
            activeConnectedPersonIds={activeConnectedPersonIds}
            togglePerson={togglePerson}
            updateAmount={updateAmount}
            updatePercentage={updatePercentage}
            people={people}
            primaryPersonId={primaryPersonId}
          />
        </div>

        <DialogFooter className="shrink-0">
          <Button data-mobile-cancel onClick={() => setOpen(false)} type="button" variant="outline">
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
