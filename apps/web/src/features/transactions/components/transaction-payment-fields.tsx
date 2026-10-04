import type { TransactionInput } from "@openmonetis/validators/transactions";
import { Plus } from "lucide-react";
import { MobileRecordSelect } from "@/components/forms/mobile-record-select";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { paymentMethodLabels } from "../transactions.presentation";
import type { useTransactionForm } from "../useTransactionForm";
import { InvoicePeriodPicker } from "./invoice-period-picker";
import { AccountSelect } from "./transaction-account-select";
import { EntityOption } from "./transaction-entity-option";
import { FieldShell } from "./transaction-field-shell";
import {
  getTransactionFormErrorMessage,
  type TransactionFormValues,
} from "./transaction-form.validation";
import { createValue, noneValue } from "./transaction-form-options";
import { PaymentMethodOption } from "./transaction-payment-method-option";
import { TransactionTransferFields } from "./transaction-transfer-fields";

export function TransactionPaymentFields({
  activeAccounts,
  activeCards,
  setRelatedAccountField,
  setRelatedRecord,
  form,
  handlePaymentMethodChange,
  handleCardChange,
  values,
  isSubmitting,
  isTransfer,
  isSeriesEdit,
  isCreditCard,
}: {
  activeAccounts: ReturnType<typeof useTransactionForm>["activeAccounts"];
  activeCards: ReturnType<typeof useTransactionForm>["activeCards"];
  setRelatedAccountField: ReturnType<typeof useTransactionForm>["setRelatedAccountField"];
  setRelatedRecord: ReturnType<typeof useTransactionForm>["setRelatedRecord"];
  form: ReturnType<typeof useTransactionForm>["form"];
  handlePaymentMethodChange: ReturnType<typeof useTransactionForm>["handlePaymentMethodChange"];
  handleCardChange: ReturnType<typeof useTransactionForm>["handleCardChange"];

  values: TransactionFormValues;
  isSubmitting: boolean;
  isTransfer: boolean;
  isSeriesEdit: boolean;
  isCreditCard: boolean;
}) {
  return (
    <>
      {!isTransfer ? (
        <div className={cn("grid gap-4", !isSeriesEdit && "sm:grid-cols-2")}>
          {!isSeriesEdit ? (
            <form.Field name="paymentMethod">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage("paymentMethod", field.state.meta.errors)}
                  label="Forma de pagamento"
                >
                  <Select
                    disabled={isSubmitting || isTransfer}
                    onValueChange={(value) =>
                      handlePaymentMethodChange(value as TransactionInput["paymentMethod"])
                    }
                    value={field.state.value}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        <PaymentMethodOption method={field.state.value} />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(paymentMethodLabels).map(([value]) => (
                        <SelectItem key={value} value={value}>
                          <PaymentMethodOption
                            method={value as TransactionInput["paymentMethod"]}
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}
            </form.Field>
          ) : null}

          {isCreditCard ? (
            <form.Field name="cardId">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage("cardId", field.state.meta.errors)}
                  label="Cartão"
                >
                  <div>
                    <MobileRecordSelect
                      title="Cartão"
                      options={[
                        { value: noneValue, label: "Selecione" },
                        ...activeCards.map((item) => ({
                          value: item.id,
                          label: item.name,
                          content: <EntityOption entity={item} />,
                        })),
                      ]}
                      createOption={{ value: createValue, label: "Criar cartão…" }}
                      invalid={field.state.meta.errors.length > 0}
                      disabled={isSubmitting}
                      onValueChange={(value) => {
                        if (value === createValue) {
                          setRelatedRecord("card");
                          return;
                        }
                        handleCardChange(value === noneValue || value === null ? "" : value);
                      }}
                      value={field.state.value || noneValue}
                    >
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={field.state.meta.errors.length > 0}
                      >
                        <SelectValue placeholder="Selecione">
                          <EntityOption
                            entity={activeCards.find((card) => card.id === field.state.value)}
                          />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={noneValue}>Selecione</SelectItem>
                        {activeCards.map((card) => (
                          <SelectItem key={card.id} value={card.id}>
                            <EntityOption entity={card} />
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value={createValue}>
                          <Plus aria-hidden="true" className="size-4" />
                          Criar cartão…
                        </SelectItem>
                      </SelectContent>
                    </MobileRecordSelect>
                    {field.state.value && values.condition !== "recurring" ? (
                      <InvoicePeriodPicker
                        cardId={values.cardId}
                        onChange={(value) => form.setFieldValue("invoicePeriod", value)}
                        purchaseDate={values.purchaseDate}
                        value={values.invoicePeriod}
                      />
                    ) : null}
                  </div>
                </FieldShell>
              )}
            </form.Field>
          ) : (
            <form.Field name="accountId">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage("accountId", field.state.meta.errors)}
                  label="Conta"
                >
                  <AccountSelect
                    onCreate={() => {
                      setRelatedAccountField("accountId");
                      setRelatedRecord("account");
                    }}
                    accounts={activeAccounts}
                    disabled={isSubmitting}
                    error={field.state.meta.errors.length > 0}
                    onChange={field.handleChange}
                    value={field.state.value}
                  />
                </FieldShell>
              )}
            </form.Field>
          )}
        </div>
      ) : (
        <TransactionTransferFields
          values={values}
          activeAccounts={activeAccounts}
          setRelatedAccountField={setRelatedAccountField}
          setRelatedRecord={setRelatedRecord}
          form={form}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
