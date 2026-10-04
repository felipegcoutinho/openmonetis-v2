import { Plus } from "lucide-react";

import { MobileRecordSelect } from "@/components/forms/mobile-record-select";

import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";

import { SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EntityOption } from "./transaction-entity-option";
import type { AccountSelectProps } from "./transaction-form.types";
import { createValue, noneValue } from "./transaction-form-options";

export function AccountSelect({
  accounts,
  value,
  disabled,
  error,
  onChange,
  onCreate,
}: AccountSelectProps) {
  return (
    <MobileRecordSelect
      title="Conta"
      options={[
        { value: noneValue, label: "Selecione" },
        ...accounts.map((item) => ({
          value: item.id,
          label: item.name,
          content: <EntityOption entity={item} />,
        })),
      ]}
      createOption={{ value: createValue, label: "Criar conta…" }}
      invalid={error}
      disabled={disabled}
      onValueChange={(nextValue) => {
        if (nextValue === createValue) {
          onCreate();
          return;
        }
        onChange(nextValue === noneValue || nextValue === null ? "" : nextValue);
      }}
      value={value || noneValue}
    >
      <SelectTrigger className="w-full" aria-invalid={error}>
        <SelectValue placeholder="Selecione">
          <EntityOption entity={accounts.find((account) => account.id === value)} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={noneValue}>Selecione</SelectItem>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={account.id}>
            <EntityOption entity={account} />
          </SelectItem>
        ))}
        <SelectSeparator />
        <SelectItem value={createValue}>
          <Plus aria-hidden="true" className="size-4" />
          Criar conta…
        </SelectItem>
      </SelectContent>
    </MobileRecordSelect>
  );
}
