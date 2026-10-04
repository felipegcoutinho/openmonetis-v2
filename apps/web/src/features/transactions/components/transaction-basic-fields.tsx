import type { CategoryOutput } from "@openmonetis/validators/categories";

import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { MobileDatePicker as DatePicker } from "@/components/forms/mobile-date-picker";
import { MobileRecordSelect } from "@/components/forms/mobile-record-select";
import { MobileSelect as Select } from "@/components/forms/mobile-select";
import { MobileSelectContent as SelectContent } from "@/components/forms/mobile-select-content";
import { SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getTransactionDateLabel, transactionTypeLabels } from "../transactions.presentation";
import type { useTransactionForm } from "../useTransactionForm";
import { EstablishmentInput } from "./establishment-input";
import { CategoryOption } from "./transaction-category-option";
import { FieldShell } from "./transaction-field-shell";
import {
  getTransactionFormErrorMessage,
  type TransactionFormValues,
  validateTransactionName,
} from "./transaction-form.validation";
import { createValue, noneValue } from "./transaction-form-options";
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
              <DatePicker
                aria-invalid={field.state.meta.errors.length > 0}
                disabled={isSubmitting}
                onChange={field.handleChange}
                value={field.state.value}
              />
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
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        <TransactionTypeOption type={field.state.value} />
                      </SelectValue>
                    </SelectTrigger>
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
                  <MobileRecordSelect
                    title="Categoria"
                    options={[
                      { value: noneValue, label: "Sem categoria" },
                      ...visibleCategories.map((item) => ({
                        value: item.id,
                        label: item.name,
                        content: <CategoryOption category={item} />,
                      })),
                    ]}
                    createOption={{ value: createValue, label: "Criar categoria…" }}
                    invalid={field.state.meta.errors.length > 0}
                    disabled={isSubmitting}
                    onValueChange={(value) => {
                      if (value === createValue) {
                        setRelatedRecord("category");
                        return;
                      }
                      field.handleChange(value === noneValue || value === null ? "" : value);
                    }}
                    value={field.state.value || noneValue}
                  >
                    <SelectTrigger
                      className="w-full"
                      aria-invalid={field.state.meta.errors.length > 0}
                    >
                      <SelectValue placeholder="Selecione">
                        <CategoryOption
                          category={visibleCategories.find(
                            (category) => category.id === field.state.value,
                          )}
                        />
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={noneValue}>Selecione</SelectItem>
                      {visibleCategories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          <CategoryOption category={category} />
                        </SelectItem>
                      ))}
                      <SelectSeparator />
                      <SelectItem value={createValue}>
                        <Plus aria-hidden="true" className="size-4" />
                        Criar categoria…
                      </SelectItem>
                    </SelectContent>
                  </MobileRecordSelect>
                </FieldShell>
              )}
            </form.Field>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
