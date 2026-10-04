import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import {
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentMethodLabels } from "../transactions.presentation";
import type { useTransactionImportReview } from "../useTransactionImportReview";
import { InvoicePeriodPicker } from "./invoice-period-picker";
import { EntityOption, Field, TextOption } from "./transaction-import-options";
import type { Props } from "./transaction-import-screen.types";
import { accountPaymentMethods } from "./transaction-import-screen-options";

export function TransactionImportDestination({
  form,
  accounts,
  cards,
  isCard,
  selectedAccount,
  selectedCard,
}: {
  form: ReturnType<typeof useTransactionImportReview>["form"];
  accounts: Props["accounts"];
  cards: Props["cards"];
  isCard: boolean;
  selectedAccount: AccountOutput | undefined;
  selectedCard: CardOutput | undefined;
}) {
  return (
    <section className="grid gap-3" aria-labelledby="destination-settings-title">
      <div>
        <h3 className="font-medium text-sm" id="destination-settings-title">
          Escolha onde registrar os lançamentos
        </h3>
        <p className="text-muted-foreground text-xs">
          Estes dados serão usados em todos os lançamentos importados.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <form.Field name="destination">
          {(field) => (
            <Field label="Conta ou cartão">
              <Select
                onValueChange={(value) => {
                  const next = value as string;
                  field.handleChange(next);
                  form.setFieldValue(
                    "paymentMethod",
                    next.startsWith("card:") ? "credit_card" : "pix",
                  );
                }}
                value={field.state.value}
              >
                <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
                  <SelectValue placeholder="Selecione uma conta ou cartão">
                    {selectedAccount ? (
                      <EntityOption entity={selectedAccount} kind="Conta" />
                    ) : selectedCard ? (
                      <EntityOption entity={selectedCard} kind="Cartão" />
                    ) : (
                      <span>Selecione uma conta ou cartão</span>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {accounts.length ? (
                    <SelectGroup>
                      <SelectLabel>Contas</SelectLabel>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={`account:${account.id}`}>
                          <EntityOption entity={account} kind="Conta" />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                  {accounts.length && cards.length ? <SelectSeparator /> : null}
                  {cards.length ? (
                    <SelectGroup>
                      <SelectLabel>Cartões</SelectLabel>
                      {cards.map((card) => (
                        <SelectItem key={card.id} value={`card:${card.id}`}>
                          <EntityOption entity={card} kind="Cartão" />
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
          )}
        </form.Field>
        {!isCard ? (
          <form.Field name="paymentMethod">
            {(field) => (
              <Field label="Forma de pagamento">
                <Select
                  onValueChange={(value) => field.handleChange(value as typeof field.state.value)}
                  value={field.state.value}
                >
                  <SelectTrigger className="h-auto min-h-14 w-full px-3 py-2">
                    <SelectValue>
                      <TextOption
                        description="Aplicada aos lançamentos desta importação"
                        label={paymentMethodLabels[field.state.value]}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {accountPaymentMethods.map((method) => (
                      <SelectItem key={method} value={method}>
                        <TextOption label={paymentMethodLabels[method]} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </form.Field>
        ) : (
          <form.Field name="invoicePeriod">
            {(field) => (
              <Field label="Fatura">
                <div className="flex min-h-14 items-center rounded-md border border-input bg-popover px-3 shadow-xs">
                  <InvoicePeriodPicker onChange={field.handleChange} value={field.state.value} />
                </div>
              </Field>
            )}
          </form.Field>
        )}
      </div>
    </section>
  );
}
