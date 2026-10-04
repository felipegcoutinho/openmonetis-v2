import { invoicePaymentCategoryName } from "@openmonetis/domain/categories";
import { MobileFormState } from "@/components/forms/mobile-form-state";
import { formatInstallmentOption } from "../transactions.presentation";
import { useTransactionForm } from "../useTransactionForm";
import { TransactionAdvancedFields } from "./transaction-advanced-fields";
import { TransactionAmountField } from "./transaction-amount-field";
import { TransactionBasicFields } from "./transaction-basic-fields";
import { TransactionBoletoFields } from "./transaction-boleto-fields";
import type { TransactionFormProps } from "./transaction-form.types";
import { TransactionFormActions } from "./transaction-form-actions";
import { TransactionFormScopeDialogs } from "./transaction-form-scope-dialogs";
import { TransactionPaymentFields } from "./transaction-payment-fields";
import { TransactionPeopleFields } from "./transaction-people-fields";
import { TransactionRelatedRecordDialog } from "./transaction-related-record-dialog";
import { TransactionScheduleFields } from "./transaction-schedule-fields";
import { TransactionSettlementField } from "./transaction-settlement-field";
import { TransactionStartInstallmentField } from "./transaction-start-installment-field";

export type { TransactionFormHandle } from "./transaction-form.types";

export function TransactionForm({
  accounts,
  cards,
  categories,
  people,
  transaction,
  mode = transaction ? "edit" : "create",
  defaultType = "expense",
  defaultPeriod,
  createDefaults,
  allowedConditions,
  lockType = false,
  showTypeSelector = false,
  submitLabel,
  attachmentBusy = false,
  establishments = [],
  establishmentsLoading = false,
  onAttachmentBusyChange,
  onCreate,
  onCreated,
  onSaved,
  onCancel,
  ref,
}: TransactionFormProps) {
  const {
    mobile,
    updateTransaction,
    updateRecurringRule,
    pendingFiles,
    setPendingFiles,
    pendingInstallmentUpdate,
    setPendingInstallmentUpdate,
    pendingRecurringUpdate,
    setPendingRecurringUpdate,
    isAdvancedOpen,
    setIsAdvancedOpen,
    activeAccounts,
    activeCards,
    activePeople,
    relatedAccountField,
    setRelatedAccountField,
    relatedRecord,
    setRelatedRecord,
    form,
    persistTransactionUpdate,
    handleTypeChange,
    handlePersonChange,
    handlePaymentMethodChange,
    handleCardChange,
  } = useTransactionForm({
    accounts,
    cards,
    categories,
    people,
    transaction,
    mode,
    defaultType,
    defaultPeriod,
    createDefaults,
    allowedConditions,
    lockType,
    showTypeSelector,
    submitLabel,
    attachmentBusy,
    establishments,
    establishmentsLoading,
    onAttachmentBusyChange,
    onCreate,
    onCreated,
    onSaved,
    onCancel,
    ref,
  });
  return (
    <>
      <form
        data-mobile-page-form
        noValidate
        aria-busy={attachmentBusy || undefined}
        className="flex min-h-0 flex-1 flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <form.Subscribe
          selector={(state) => ({
            isDirty: !state.isDefaultValue,
            isSubmitting: state.isSubmitting,
          })}
        >
          {(state) => <MobileFormState {...state} />}
        </form.Subscribe>
        <form.Subscribe
          selector={(state) => ({
            isDirty: state.isDirty,
            isSubmitting: state.isSubmitting,
            values: state.values,
          })}
        >
          {({ isDirty, isSubmitting, values }) => {
            const isTransfer = values.type === "transfer";
            const isSplitBetweenPeople = values.splitShares.length >= 2;
            const isSeriesEdit =
              mode === "edit" &&
              Boolean(
                transaction && (transaction.condition === "installment" || transaction.isRecurring),
              );
            const isCreditCard = values.paymentMethod === "credit_card";
            const isBoleto = values.paymentMethod === "boleto";
            const showBoletoPaymentDate =
              values.condition !== "recurring" && values.isSettled === "true";
            const visibleCategories = categories.filter(
              (category) =>
                category.type === values.type && category.name !== invoicePaymentCategoryName,
            );
            const installmentAmount = Number(values.amount);
            const installmentCount = Number(values.installmentCount);
            const startInstallment = Number(values.startInstallment);
            const showStartInstallment = values.condition === "installment" && mode !== "edit";

            const getInstallmentLabel = (count: number) =>
              formatInstallmentOption(installmentAmount, count);

            const amountField = (
              <TransactionAmountField form={form} isSubmitting={isSubmitting} values={values} />
            );

            return (
              <>
                <div
                  data-mobile-form-body
                  className="-ml-1 -mr-3 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-3 pl-1"
                >
                  <TransactionBasicFields
                    mobile={mobile}
                    setRelatedRecord={setRelatedRecord}
                    form={form}
                    handleTypeChange={handleTypeChange}
                    lockType={lockType}
                    showTypeSelector={showTypeSelector}
                    establishmentsLoading={establishmentsLoading}
                    establishments={establishments}
                    values={values}
                    isSubmitting={isSubmitting}
                    isTransfer={isTransfer}
                    isSeriesEdit={isSeriesEdit}
                    visibleCategories={visibleCategories}
                    amountField={amountField}
                  />

                  <TransactionPeopleFields
                    activePeople={activePeople}
                    setRelatedRecord={setRelatedRecord}
                    form={form}
                    handlePersonChange={handlePersonChange}
                    values={values}
                    isSubmitting={isSubmitting}
                    isTransfer={isTransfer}
                    isSplitBetweenPeople={isSplitBetweenPeople}
                  />

                  <section className="grid gap-4">
                    <TransactionPaymentFields
                      activeAccounts={activeAccounts}
                      activeCards={activeCards}
                      setRelatedAccountField={setRelatedAccountField}
                      setRelatedRecord={setRelatedRecord}
                      form={form}
                      handlePaymentMethodChange={handlePaymentMethodChange}
                      handleCardChange={handleCardChange}
                      values={values}
                      isSubmitting={isSubmitting}
                      isTransfer={isTransfer}
                      isSeriesEdit={isSeriesEdit}
                      isCreditCard={isCreditCard}
                    />

                    <TransactionBoletoFields
                      form={form}
                      isSubmitting={isSubmitting}
                      isBoleto={isBoleto}
                      showBoletoPaymentDate={showBoletoPaymentDate}
                    />

                    <TransactionScheduleFields
                      pendingFiles={pendingFiles}
                      setPendingFiles={setPendingFiles}
                      form={form}
                      transaction={transaction}
                      allowedConditions={allowedConditions}
                      values={values}
                      isSubmitting={isSubmitting}
                      isTransfer={isTransfer}
                      isSeriesEdit={isSeriesEdit}
                      getInstallmentLabel={getInstallmentLabel}
                    />

                    <TransactionSettlementField
                      form={form}
                      transaction={transaction}
                      mode={mode}
                      values={values}
                      isSubmitting={isSubmitting}
                      isTransfer={isTransfer}
                      isCreditCard={isCreditCard}
                      isBoleto={isBoleto}
                    />
                  </section>

                  <TransactionStartInstallmentField
                    form={form}
                    isSubmitting={isSubmitting}
                    isTransfer={isTransfer}
                    showStartInstallment={showStartInstallment}
                    installmentCount={installmentCount}
                    startInstallment={startInstallment}
                  />

                  <TransactionAdvancedFields
                    pendingFiles={pendingFiles}
                    setPendingFiles={setPendingFiles}
                    isAdvancedOpen={isAdvancedOpen}
                    setIsAdvancedOpen={setIsAdvancedOpen}
                    form={form}
                    transaction={transaction}
                    onAttachmentBusyChange={onAttachmentBusyChange}
                    mode={mode}
                    values={values}
                    isSubmitting={isSubmitting}
                  />
                </div>

                <TransactionFormActions
                  transaction={transaction}
                  attachmentBusy={attachmentBusy}
                  onCancel={onCancel}
                  submitLabel={submitLabel}
                  mode={mode}
                  values={values}
                  isDirty={isDirty}
                  isSubmitting={isSubmitting}
                />
              </>
            );
          }}
        </form.Subscribe>
        <TransactionFormScopeDialogs
          pendingInstallmentUpdate={pendingInstallmentUpdate}
          setPendingInstallmentUpdate={setPendingInstallmentUpdate}
          pendingRecurringUpdate={pendingRecurringUpdate}
          setPendingRecurringUpdate={setPendingRecurringUpdate}
          persistTransactionUpdate={persistTransactionUpdate}
          updateTransaction={updateTransaction}
          updateRecurringRule={updateRecurringRule}
          transaction={transaction}
          onSaved={onSaved}
        />{" "}
      </form>
      <form.Subscribe selector={(state) => state.values.type}>
        {(type) => (
          <TransactionRelatedRecordDialog
            kind={relatedRecord}
            categoryType={type === "income" ? "income" : "expense"}
            accounts={accounts}
            onClose={() => setRelatedRecord(null)}
            onCreated={(kind, id) => {
              if (kind === "card") handleCardChange(id);
              else
                form.setFieldValue(
                  kind === "account"
                    ? relatedAccountField
                    : kind === "person"
                      ? "personId"
                      : "categoryId",
                  id,
                );
              setRelatedRecord(null);
            }}
          />
        )}
      </form.Subscribe>
    </>
  );
}
