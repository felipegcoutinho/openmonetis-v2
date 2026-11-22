import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { Label } from "@/components/ui/label";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { useCardForm } from "../useCardForm";
import { AccountOption } from "./card-account-option";
import type { CardFormProps } from "./card-form.types";

export function CardAccountField({
  accounts,
  form,
  fieldId,
}: {
  accounts: CardFormProps["accounts"];
  form: ReturnType<typeof useCardForm>["form"];
  fieldId: ReturnType<typeof useCardForm>["fieldId"];
}) {
  return (
    <form.Field name="accountId">
      {(field) => (
        <div className="grid gap-1.5 sm:col-span-2">
          <Label htmlFor={fieldId(field.name)}>Conta vinculada</Label>
          <Select
            disabled={accounts.length === 0}
            onValueChange={(value) => {
              if (value) field.handleChange(value);
            }}
            value={field.state.value}
          >
            <SelectTrigger className="w-full" id={fieldId(field.name)}>
              <SelectValue
                placeholder={accounts.length ? "Selecione a conta" : "Cadastre uma conta primeiro"}
              >
                {(() => {
                  const account = accounts.find((item) => item.id === field.state.value);
                  return account ? <AccountOption account={account} /> : null;
                })()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  <AccountOption account={account} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </form.Field>
  );
}
