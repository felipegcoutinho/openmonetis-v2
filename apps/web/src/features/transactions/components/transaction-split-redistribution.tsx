import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { useTransactionSplitEditor } from "../useTransactionSplitEditor";

import type { TransactionSplitDialogProps } from "./transaction-split-dialog.types";

export function TransactionSplitRedistribution({
  setRedistributionSelection,
  redistributeDifference,
  allocation,
  redistributionCandidates,
  showRedistribution,
  selectedRedistributionPersonId,
  selectedRedistributionPerson,
  people,
}: {
  setRedistributionSelection: ReturnType<
    typeof useTransactionSplitEditor
  >["setRedistributionSelection"];
  redistributeDifference: ReturnType<typeof useTransactionSplitEditor>["redistributeDifference"];
  allocation: ReturnType<typeof useTransactionSplitEditor>["allocation"];
  redistributionCandidates: ReturnType<
    typeof useTransactionSplitEditor
  >["redistributionCandidates"];
  showRedistribution: ReturnType<typeof useTransactionSplitEditor>["showRedistribution"];
  selectedRedistributionPersonId: ReturnType<
    typeof useTransactionSplitEditor
  >["selectedRedistributionPersonId"];
  selectedRedistributionPerson: ReturnType<
    typeof useTransactionSplitEditor
  >["selectedRedistributionPerson"];
  people: TransactionSplitDialogProps["people"];
}) {
  return (
    <>
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
    </>
  );
}
