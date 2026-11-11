import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";
import type { TransactionSplitDialogProps } from "./transaction-split-dialog.types";
import { TransactionSplitShareRow } from "./transaction-split-share-row";

type SplitEditor = ReturnType<typeof useTransactionSplitEditor>;

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
  draft: SplitEditor["draft"];
  percentageDraft: SplitEditor["percentageDraft"];
  splitMode: SplitEditor["splitMode"];
  activeConnectedPersonIds: SplitEditor["activeConnectedPersonIds"];
  togglePerson: SplitEditor["togglePerson"];
  updateAmount: SplitEditor["updateAmount"];
  updatePercentage: SplitEditor["updatePercentage"];
  people: TransactionSplitDialogProps["people"];
  primaryPersonId: TransactionSplitDialogProps["primaryPersonId"];
}) {
  return (
    <section className="grid gap-2" aria-labelledby="split-people-title">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className="font-medium text-sm" id="split-people-title">
            Pessoas
          </h3>
          <p className="text-pretty text-muted-foreground text-xs">
            {splitMode === "percentage"
              ? "Ao marcar alguém, os percentuais são refeitos em partes iguais."
              : "Ao marcar alguém, o valor é refeito em partes iguais."}
          </p>
        </div>
        <p className="shrink-0 text-muted-foreground text-xs tabular-nums">
          {draft.length} de {people.length}
        </p>
      </div>

      <div className="divide-y overflow-hidden rounded-lg border">
        {people.map((person) => {
          const share = draft.find((item) => item.personId === person.id);
          const percentageShare = percentageDraft.find((item) => item.personId === person.id);

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
              percentageValue={percentageShare?.percentage ?? ""}
              isPrimary={person.id === primaryPersonId}
              isSelected={Boolean(share)}
            />
          );
        })}
      </div>
    </section>
  );
}
