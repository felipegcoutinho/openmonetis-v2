import { Badge } from "@/components/ui/badge";

import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";
import type { TransactionSplitDialogProps } from "./transaction-split-dialog.types";
import { TransactionSplitShareRow } from "./transaction-split-share-row";

export function TransactionSplitParticipants({
  draft,
  percentageDraft,
  splitMode,
  activeConnectedPersonIds,
  togglePerson,
  updateAmount,
  updatePercentage,
  people,
  primaryPersonId,
}: {
  draft: ReturnType<typeof useTransactionSplitEditor>["draft"];
  percentageDraft: ReturnType<typeof useTransactionSplitEditor>["percentageDraft"];
  splitMode: ReturnType<typeof useTransactionSplitEditor>["splitMode"];
  activeConnectedPersonIds: ReturnType<
    typeof useTransactionSplitEditor
  >["activeConnectedPersonIds"];
  togglePerson: ReturnType<typeof useTransactionSplitEditor>["togglePerson"];
  updateAmount: ReturnType<typeof useTransactionSplitEditor>["updateAmount"];
  updatePercentage: ReturnType<typeof useTransactionSplitEditor>["updatePercentage"];
  people: TransactionSplitDialogProps["people"];
  primaryPersonId: TransactionSplitDialogProps["primaryPersonId"];
}) {
  return (
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
            <TransactionSplitShareRow
              key={person.id}
              splitMode={splitMode}
              activeConnectedPersonIds={activeConnectedPersonIds}
              togglePerson={togglePerson}
              updateAmount={updateAmount}
              updatePercentage={updatePercentage}
              person={person}
              share={share}
              percentageValue={percentageValue}
              isPrimary={isPrimary}
              isSelected={isSelected}
            />
          );
        })}
      </div>
    </section>
  );
}
