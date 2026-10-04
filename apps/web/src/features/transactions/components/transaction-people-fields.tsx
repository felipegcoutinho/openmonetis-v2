import { Plus } from "lucide-react";
import { MobileRecordSelect } from "@/components/forms/mobile-record-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { useTransactionForm } from "../useTransactionForm";
import { FieldShell } from "./transaction-field-shell";

import {
  getTransactionFormErrorMessage,
  type TransactionFormValues,
} from "./transaction-form.validation";
import { createValue, noneValue } from "./transaction-form-options";
import { PersonOption } from "./transaction-person-option";
import { TransactionSplitDialog } from "./transaction-split-dialog";

export function TransactionPeopleFields({
  activePeople,
  setRelatedRecord,
  form,
  handlePersonChange,
  values,
  isSubmitting,
  isTransfer,
  isSplitBetweenPeople,
}: {
  activePeople: ReturnType<typeof useTransactionForm>["activePeople"];
  setRelatedRecord: ReturnType<typeof useTransactionForm>["setRelatedRecord"];
  form: ReturnType<typeof useTransactionForm>["form"];
  handlePersonChange: ReturnType<typeof useTransactionForm>["handlePersonChange"];

  values: TransactionFormValues;
  isSubmitting: boolean;
  isTransfer: boolean;
  isSplitBetweenPeople: boolean;
}) {
  return (
    <>
      {!isTransfer ? (
        <section className="grid gap-4">
          {!isSplitBetweenPeople ? (
            <form.Field name="personId">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage("personId", field.state.meta.errors)}
                  label={
                    values.type === "expense" ? "De quem é esta despesa?" : "Pessoa responsável"
                  }
                >
                  <MobileRecordSelect
                    title="Pessoa responsável"
                    options={[
                      { value: noneValue, label: "Selecione" },
                      ...activePeople.map((item) => ({
                        value: item.id,
                        label: item.name,
                        content: <PersonOption person={item} />,
                      })),
                    ]}
                    createOption={{ value: createValue, label: "Criar pessoa…" }}
                    invalid={field.state.meta.errors.length > 0}
                    disabled={isSubmitting || isTransfer}
                    onValueChange={(value) => {
                      if (value === createValue) {
                        setRelatedRecord("person");
                        return;
                      }
                      handlePersonChange(value === noneValue || value === null ? "" : value);
                    }}
                    value={field.state.value || noneValue}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        <PersonOption
                          person={activePeople.find((person) => person.id === field.state.value)}
                        />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={noneValue}>Selecione</SelectItem>
                      {activePeople.map((person) => (
                        <SelectItem key={person.id} value={person.id}>
                          <PersonOption person={person} />
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={createValue}>
                        <Plus aria-hidden="true" className="size-4" />
                        Criar pessoa…
                      </SelectItem>
                    </SelectContent>
                  </MobileRecordSelect>
                </FieldShell>
              )}
            </form.Field>
          ) : null}
          {activePeople.length > 1 ? (
            <form.Field name="splitShares">
              {(field) => (
                <TransactionSplitDialog
                  amount={values.amount}
                  disabled={isSubmitting}
                  onChange={field.handleChange}
                  people={activePeople}
                  primaryPersonId={values.personId}
                  value={field.state.value}
                />
              )}
            </form.Field>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
