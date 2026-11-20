import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { ReactNode } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryPicker } from "@/features/categories/components/category-picker";
import { cn } from "@/lib/utils";
import { getTransactionDateLabel, transactionTypeLabels } from "../transactions.presentation";
import type { useTransactionForm } from "../useTransactionForm";
import { EstablishmentInput } from "./establishment-input";
import { FieldShell, FieldShellControl } from "./transaction-field-shell";
import {
  getTransactionFormErrorMessage,
  type TransactionFormValues,
  validateTransactionName,
} from "./transaction-form.validation";
import { TransactionTypeOption } from "./transaction-type-option";
export function TransactionBasicFields({
  mobile,
  setRelatedRecord,
  form,
  handleTypeChange,
  lockType,
  showTypeSelector,
  establishmentsLoading,
  establishments,
  values,
  isSubmitting,
  isTransfer,
  isSeriesEdit,
  visibleCategories,
  amountField,
}: {
  mobile: ReturnType<typeof useTransactionForm>["mobile"];
  setRelatedRecord: ReturnType<typeof useTransactionForm>["setRelatedRecord"];
  form: ReturnType<typeof useTransactionForm>["form"];
  handleTypeChange: ReturnType<typeof useTransactionForm>["handleTypeChange"];
  lockType: boolean;
  showTypeSelector: boolean;
  establishmentsLoading: boolean;
  establishments: string[];
  values: TransactionFormValues;
  isSubmitting: boolean;
  isTransfer: boolean;
  isSeriesEdit: boolean;
  visibleCategories: CategoryOutput[];
  amountField: ReactNode;
}) {
  return (
    <section className="grid gap-4">
      {mobile ? amountField : null}
      <form.Field
        name="name"
        validators={{ onChange: ({ value }) => validateTransactionName(value) }}
      >
        {(field) => (
          <FieldShell
            error={getTransactionFormErrorMessage("name", field.state.meta.errors)}
            label="Descrição"
          >
            <EstablishmentInput
              disabled={isSubmitting}
              establishments={isTransfer ? [] : establishments}
              invalid={field.state.meta.errors.length > 0}
              loading={!isTransfer && establishmentsLoading}
              maxLength={160}
              onBlur={field.handleBlur}
              onChange={field.handleChange}
              placeholder={isTransfer ? "Ex.: Transferência para reserva" : "Ex.: Restaurante"}
              value={field.state.value}
            />
          </FieldShell>
        )}
      </form.Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="purchaseDate">
          {(field) => (
            <FieldShell
              error={getTransactionFormErrorMessage("purchaseDate", field.state.meta.errors)}
              label={getTransactionDateLabel(values.type, values.condition)}
            >
              <FieldShellControl withOwnText>
                <DatePicker
                  aria-invalid={field.state.meta.errors.length > 0}
                  disabled={isSubmitting}
                  onChange={field.handleChange}
                  value={field.state.value}
                />
              </FieldShellControl>
            </FieldShell>
          )}
        </form.Field>

        {!mobile ? amountField : null}
      </div>

      {(showTypeSelector && !isSeriesEdit) || !isTransfer ? (
        <div
          className={cn(
            "grid gap-4",
            showTypeSelector && !isTransfer && !isSeriesEdit && "sm:grid-cols-2",
          )}
        >
          {showTypeSelector && !isSeriesEdit ? (
            <form.Field name="type">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage("type", field.state.meta.errors)}
                  label="Tipo de transação"
                >
                  <Select
                    disabled={isSubmitting || lockType}
                    onValueChange={(value) =>
                      handleTypeChange(value as TransactionFormValues["type"])
                    }
                    value={field.state.value}
                  >
                    <FieldShellControl>
                      <SelectTrigger
                        className="w-full"
                        aria-invalid={field.state.meta.errors.length > 0}
                      >
                        <SelectValue placeholder="Selecione">
                          <TransactionTypeOption type={field.state.value} />
                        </SelectValue>
                      </SelectTrigger>
                    </FieldShellControl>
                    <SelectContent>
                      {Object.keys(transactionTypeLabels).map((value) => (
                        <SelectItem key={value} value={value}>
                          <TransactionTypeOption type={value as TransactionFormValues["type"]} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldShell>
              )}
            </form.Field>
          ) : null}

          {!isTransfer ? (
            <form.Field name="categoryId">
              {(field) => (
                <FieldShell
                  error={getTransactionFormErrorMessage("categoryId", field.state.meta.errors)}
                  label="Categoria"
                >
                  <CategoryPicker
                    categories={visibleCategories}
                    value={field.state.value}
                    onChange={field.handleChange}
                    onCreate={() => setRelatedRecord("category")}
                    disabled={isSubmitting}
                    invalid={field.state.meta.errors.length > 0}
                  />
                </FieldShell>
              )}
            </form.Field>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
