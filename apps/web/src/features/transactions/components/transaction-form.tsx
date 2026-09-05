import { invoicePaymentCategoryName } from "@openmonetis/domain/categories";
import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type {
  TransactionActionScope,
  TransactionInput,
  TransactionOutput,
  UpdateTransactionInput,
} from "@openmonetis/validators/transactions";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Image } from "@unpic/react";
import {
  ArrowRight,
  Banknote,
  Barcode,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  CircleCheck,
  CreditCard,
  Landmark,
  Loader2,
  QrCode,
  RefreshCw,
  Save,
  Ticket,
} from "lucide-react";
import { type ReactNode, type Ref, useId, useImperativeHandle, useMemo, useState } from "react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { DatePicker } from "@/components/ui/date-picker";
import { DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uploadAttachment } from "@/features/attachments/attachments.api";
import { attachmentKeys } from "@/features/attachments/attachments.queries";
import { AttachmentFilePicker } from "@/features/attachments/components/attachment-file-picker";
import { TransactionAttachments } from "@/features/attachments/components/transaction-attachments";
import { CategoryIcon } from "@/features/categories/category-icons";
import { showInvalidFormToast } from "@/lib/form-feedback";
import { cn } from "@/lib/utils";
import {
  useCreateTransactionMutation,
  useUpdateRecurringRuleMutation,
  useUpdateTransactionMutation,
} from "../transactions.mutations";
import {
  formatInstallmentOption,
  getTransactionDateLabel,
  getTransactionMutationErrorMessage,
  paymentMethodLabels,
  recurrenceFrequencyLabels,
  transactionConditionLabels,
  transactionTypeLabels,
} from "../transactions.presentation";
import { transactionKeys } from "../transactions.queries";
import { EstablishmentInput } from "./establishment-input";
import { InstallmentActionDialog } from "./installment-action-dialog";
import { InvoicePeriodPicker } from "./invoice-period-picker";
import {
  getChangedTransactionInput,
  getDefaultTransactionFormValues,
  getTrackedInstallmentHelper,
  getTransactionFormErrorMessage,
  getTransactionFormValuesFromTransaction,
  normalizeTransactionInput,
  type TransactionCreateDefaults,
  type TransactionFormValues,
  validateTransactionAmount,
  validateTransactionForm,
  validateTransactionName,
} from "./transaction-form.validation";
import { TransactionSplitDialog } from "./transaction-split-dialog";
import { transactionTypeIconStyles, transactionTypeIcons } from "./transaction-type-badge";

type TransactionFormProps = {
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  transaction: TransactionOutput | null;
  mode?: "create" | "edit" | "copy";
  defaultType?: TransactionInput["type"];
  defaultPeriod?: string;
  createDefaults?: TransactionCreateDefaults;
  allowedConditions?: readonly TransactionFormValues["condition"][];
  lockType?: boolean;
  showTypeSelector?: boolean;
  submitLabel?: string;
  attachmentBusy?: boolean;
  establishments?: string[];
  establishmentsLoading?: boolean;
  onAttachmentBusyChange?: (busy: boolean) => void;
  onCreate?: (input: TransactionInput) => Promise<TransactionOutput>;
  onCreated?: (transaction: TransactionOutput) => Promise<void> | void;
  onSaved: () => void;
  onCancel: () => void;
  ref?: Ref<TransactionFormHandle>;
};

export type TransactionFormHandle = {
  hasUnsavedChanges: () => boolean;
};

const noneValue = "__none__";

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
  const createTransaction = useCreateTransactionMutation();
  const updateTransaction = useUpdateTransactionMutation();
  const updateRecurringRule = useUpdateRecurringRuleMutation();
  const queryClient = useQueryClient();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingInstallmentUpdate, setPendingInstallmentUpdate] = useState<{
    data: TransactionInput;
    value: TransactionFormValues;
  } | null>(null);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(mode !== "edit" && Boolean(transaction));
  const activeAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived),
    [accounts],
  );
  const activeCards = useMemo(() => cards.filter((card) => card.status === "active"), [cards]);
  const activePeople = useMemo(
    () => people.filter((person) => person.status === "active"),
    [people],
  );
  const adminPerson = activePeople.find((person) => person.role === "admin");
  const defaultValues = useMemo(
    () =>
      transaction
        ? getTransactionFormValuesFromTransaction(
            transaction,
            accounts,
            cards,
            people,
            mode === "copy" ? "copy" : "edit",
          )
        : getDefaultTransactionFormValues(
            accounts,
            cards,
            people,
            defaultType,
            defaultPeriod,
            createDefaults,
          ),
    [accounts, cards, createDefaults, defaultPeriod, defaultType, mode, people, transaction],
  );
  const form = useForm({
    defaultValues,
    onSubmitInvalid: showInvalidFormToast,
    validators: {
      onSubmit: validateTransactionForm,
    },
    onSubmit: async ({ value }) => {
      try {
        const data = normalizeTransactionInput(value, {
          includeStartInstallment: mode !== "edit",
        });

        if (mode === "edit" && transaction?.isRecurring && transaction.recurringRuleId) {
          await updateRecurringRule.mutateAsync({ id: transaction.recurringRuleId, data });
          toast.success("Recorrência atualizada");
          onSaved();
          return;
        }
        if (mode === "edit" && transaction?.recordId) {
          if (transaction.condition === "installment" && transaction.seriesId) {
            setPendingInstallmentUpdate({ data, value });
            return;
          }
          await persistTransactionUpdate(data, "single");
          return;
        }

        const created = onCreate ? await onCreate(data) : await createTransaction.mutateAsync(data);
        const uploadResults = created.recordId
          ? await Promise.allSettled(
              pendingFiles.map((file) => uploadAttachment(file, created.recordId as string)),
            )
          : [];
        const failedUploads = created.recordId
          ? uploadResults.filter((result) => result.status === "rejected").length
          : pendingFiles.length;

        if (pendingFiles.length) {
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: attachmentKeys.all }),
            queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
          ]);
        }

        if (failedUploads) {
          toast.warning("Lançamento salvo, mas houve falha nos anexos", {
            description:
              failedUploads === 1
                ? "1 arquivo não foi enviado. Edite o lançamento para tentar novamente."
                : `${failedUploads} arquivos não foram enviados. Edite o lançamento para tentar novamente.`,
          });
        } else {
          toast.success("Lançamento salvo", {
            description: `${data.name} foi cadastrado com sucesso.`,
          });
        }
        form.reset(
          getDefaultTransactionFormValues(
            accounts,
            cards,
            people,
            defaultType,
            defaultPeriod,
            createDefaults,
          ),
        );
        setPendingFiles([]);
        if (onCreated) {
          try {
            await onCreated(created);
          } catch {
            toast.warning("Lançamento salvo, mas o pré-lançamento continua pendente.", {
              description: "Revise a caixa de pré-lançamentos antes de tentar novamente.",
            });
          }
        }
        onSaved();
      } catch (error) {
        toast.error("Não foi possível salvar o lançamento", {
          description: getTransactionMutationErrorMessage(error),
        });
      }
    },
  });

  useImperativeHandle(ref, () => ({
    hasUnsavedChanges: () => form.state.isDirty || pendingFiles.length > 0,
  }));

  async function persistTransactionUpdate(
    data: TransactionInput,
    scope: TransactionActionScope,
    value?: TransactionFormValues,
  ) {
    const updateData: UpdateTransactionInput =
      scope === "single" || !value ? data : getChangedTransactionInput(data, value, defaultValues);
    await updateTransaction.mutateAsync({
      id: transaction?.recordId as string,
      data: updateData,
      scope,
    });
    setPendingInstallmentUpdate(null);
    toast.success("Lançamento atualizado", {
      description: `${data.name} foi atualizado com sucesso.`,
    });
    onSaved();
  }

  function handleTypeChange(value: TransactionFormValues["type"]) {
    form.setFieldValue("type", value);
    form.setFieldValue("categoryId", "");

    if (value === "transfer") {
      form.setFieldValue("paymentMethod", "bank_transfer");
      form.setFieldValue("condition", "single");
      form.setFieldValue("personId", adminPerson?.id ?? "");
      form.setFieldValue("isSettled", "false");
      form.setFieldValue("boletoPaymentDate", "");
      form.setFieldValue("splitShares", []);
      form.setFieldValue("accountId", "");
      form.setFieldValue("cardId", "");
      form.setFieldValue(
        "sourceAccountId",
        form.getFieldValue("sourceAccountId") || activeAccounts[0]?.id || "",
      );
      form.setFieldValue("destinationAccountId", "");
    }
  }

  function handlePersonChange(personId: string) {
    form.setFieldValue("personId", personId);
  }

  function handlePaymentMethodChange(value: TransactionFormValues["paymentMethod"]) {
    form.setFieldValue("paymentMethod", value);

    if (value === "credit_card") {
      form.setFieldValue("accountId", "");
      form.setFieldValue("cardId", form.getFieldValue("cardId") || activeCards[0]?.id || "");
      form.setFieldValue("isSettled", "true");
      form.setFieldValue("boletoPaymentDate", "");
      return;
    }

    form.setFieldValue("cardId", "");
    form.setFieldValue("accountId", form.getFieldValue("accountId") || activeAccounts[0]?.id || "");
    form.setFieldValue("isSettled", "false");
    form.setFieldValue("boletoPaymentDate", "");
  }

  function handleCardChange(cardId: string) {
    if (cardId === form.getFieldValue("cardId")) return;
    form.setFieldValue("cardId", cardId);
    form.setFieldValue("invoicePeriod", "");
  }

  return (
    <form
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
          canSubmit: state.canSubmit,
          isDirty: state.isDirty,
          isSubmitting: state.isSubmitting,
          values: state.values,
        })}
      >
        {({ canSubmit, isDirty, isSubmitting, values }) => {
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
          const formIsValid = validateTransactionForm({ value: values }) === undefined;
          const getInstallmentLabel = (count: number) =>
            formatInstallmentOption(installmentAmount, count);

          return (
            <>
              <div className="-ml-1 -mr-3 flex min-h-0 min-w-0 flex-1 flex-col gap-4 overflow-y-auto pr-3 pl-1">
                <section className="grid gap-4">
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
                          placeholder={
                            isTransfer ? "Ex.: Transferência para reserva" : "Ex.: Restaurante"
                          }
                          value={field.state.value}
                        />
                      </FieldShell>
                    )}
                  </form.Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <form.Field name="purchaseDate">
                      {(field) => (
                        <FieldShell
                          error={getTransactionFormErrorMessage(
                            "purchaseDate",
                            field.state.meta.errors,
                          )}
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

                    <form.Field
                      name="amount"
                      validators={{ onChange: ({ value }) => validateTransactionAmount(value) }}
                    >
                      {(field) => (
                        <FieldShell
                          error={getTransactionFormErrorMessage("amount", field.state.meta.errors)}
                          label="Valor"
                        >
                          <CurrencyInput
                            aria-invalid={field.state.meta.errors.length > 0}
                            disabled={isSubmitting}
                            onBlur={field.handleBlur}
                            onValueChange={field.handleChange}
                            placeholder="R$ 0,00"
                            required
                            value={field.state.value}
                          />
                        </FieldShell>
                      )}
                    </form.Field>
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
                              error={getTransactionFormErrorMessage(
                                "type",
                                field.state.meta.errors,
                              )}
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
                                      <TransactionTypeOption
                                        type={value as TransactionFormValues["type"]}
                                      />
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
                              error={getTransactionFormErrorMessage(
                                "categoryId",
                                field.state.meta.errors,
                              )}
                              label="Categoria"
                            >
                              <Select
                                disabled={isSubmitting}
                                onValueChange={(value) =>
                                  field.handleChange(
                                    value === noneValue || value === null ? "" : value,
                                  )
                                }
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
                                </SelectContent>
                              </Select>
                            </FieldShell>
                          )}
                        </form.Field>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                {!isTransfer ? (
                  <section className="grid gap-4">
                    {!isSplitBetweenPeople ? (
                      <form.Field name="personId">
                        {(field) => (
                          <FieldShell
                            error={getTransactionFormErrorMessage(
                              "personId",
                              field.state.meta.errors,
                            )}
                            label="Pessoa"
                          >
                            <Select
                              disabled={isSubmitting || isTransfer}
                              onValueChange={(value) =>
                                handlePersonChange(
                                  value === noneValue || value === null ? "" : value,
                                )
                              }
                              value={field.state.value || noneValue}
                            >
                              <SelectTrigger
                                className="w-full"
                                aria-invalid={field.state.meta.errors.length > 0}
                              >
                                <SelectValue placeholder="Selecione">
                                  <PersonOption
                                    person={activePeople.find(
                                      (person) => person.id === field.state.value,
                                    )}
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
                              </SelectContent>
                            </Select>
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

                <section className="grid gap-4">
                  {!isTransfer ? (
                    <div className={cn("grid gap-4", !isSeriesEdit && "sm:grid-cols-2")}>
                      {!isSeriesEdit ? (
                        <form.Field name="paymentMethod">
                          {(field) => (
                            <FieldShell
                              error={getTransactionFormErrorMessage(
                                "paymentMethod",
                                field.state.meta.errors,
                              )}
                              label="Forma de pagamento"
                            >
                              <Select
                                disabled={isSubmitting || isTransfer}
                                onValueChange={(value) =>
                                  handlePaymentMethodChange(
                                    value as TransactionInput["paymentMethod"],
                                  )
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
                              error={getTransactionFormErrorMessage(
                                "cardId",
                                field.state.meta.errors,
                              )}
                              label="Cartão"
                            >
                              <div>
                                <Select
                                  disabled={isSubmitting}
                                  onValueChange={(value) =>
                                    handleCardChange(
                                      value === noneValue || value === null ? "" : value,
                                    )
                                  }
                                  value={field.state.value || noneValue}
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-invalid={field.state.meta.errors.length > 0}
                                  >
                                    <SelectValue placeholder="Selecione">
                                      <EntityOption
                                        entity={activeCards.find(
                                          (card) => card.id === field.state.value,
                                        )}
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
                                  </SelectContent>
                                </Select>
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
                              error={getTransactionFormErrorMessage(
                                "accountId",
                                field.state.meta.errors,
                              )}
                              label="Conta"
                            >
                              <AccountSelect
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
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
                      <form.Field name="sourceAccountId">
                        {(field) => (
                          <FieldShell
                            error={getTransactionFormErrorMessage(
                              "sourceAccountId",
                              field.state.meta.errors,
                            )}
                            label="Conta de origem"
                          >
                            <AccountSelect
                              accounts={activeAccounts.filter(
                                (account) => account.id !== values.destinationAccountId,
                              )}
                              disabled={isSubmitting}
                              error={field.state.meta.errors.length > 0}
                              onChange={field.handleChange}
                              value={field.state.value}
                            />
                          </FieldShell>
                        )}
                      </form.Field>

                      <div
                        aria-hidden="true"
                        className="flex h-5 items-center justify-center text-muted-foreground sm:h-9"
                      >
                        <ArrowRight className="size-4 rotate-90 sm:rotate-0" />
                      </div>

                      <form.Field name="destinationAccountId">
                        {(field) => (
                          <FieldShell
                            error={getTransactionFormErrorMessage(
                              "destinationAccountId",
                              field.state.meta.errors,
                            )}
                            label="Conta de destino"
                          >
                            <AccountSelect
                              accounts={activeAccounts.filter(
                                (account) => account.id !== values.sourceAccountId,
                              )}
                              disabled={isSubmitting}
                              error={field.state.meta.errors.length > 0}
                              onChange={field.handleChange}
                              value={field.state.value}
                            />
                          </FieldShell>
                        )}
                      </form.Field>
                    </div>
                  )}

                  {isBoleto ? (
                    <div className={cn("grid gap-4", showBoletoPaymentDate && "sm:grid-cols-2")}>
                      <form.Field name="dueDate">
                        {(field) => (
                          <FieldShell
                            error={getTransactionFormErrorMessage(
                              "dueDate",
                              field.state.meta.errors,
                            )}
                            label="Vencimento do boleto"
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

                      {showBoletoPaymentDate ? (
                        <form.Field name="boletoPaymentDate">
                          {(field) => (
                            <FieldShell
                              error={getTransactionFormErrorMessage(
                                "boletoPaymentDate",
                                field.state.meta.errors,
                              )}
                              label="Data do pagamento"
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
                      ) : null}
                    </div>
                  ) : null}

                  {!isCreditCard ? (
                    <form.Field name="isSettled">
                      {(field) => {
                        const isSettled = field.state.value === "true";

                        return (
                          <section
                            className={cn(
                              "flex items-center justify-between gap-4 rounded-lg border border-input bg-popover px-3 py-2.5 transition-colors",
                              isSettled && "border-success/20 bg-success/5",
                            )}
                          >
                            <div className="min-w-0">
                              <p className="text-left font-medium text-sm">
                                {isTransfer ? "Transferência realizada" : "Pagamento realizado"}
                              </p>
                              <p className="text-left text-muted-foreground text-xs">
                                {isTransfer
                                  ? "Ative quando a movimentação já tiver sido concluída."
                                  : "Ative quando o valor já tiver sido pago."}
                              </p>
                            </div>
                            <Button
                              aria-label={
                                isTransfer
                                  ? isSettled
                                    ? "Marcar transferência como pendente"
                                    : "Marcar transferência como realizada"
                                  : isSettled
                                    ? "Marcar pagamento como pendente"
                                    : "Marcar pagamento como realizado"
                              }
                              aria-pressed={isSettled}
                              className={
                                isSettled
                                  ? "bg-success/10 text-success hover:bg-success/20 hover:text-success"
                                  : "text-muted-foreground hover:text-foreground"
                              }
                              disabled={isSubmitting}
                              onClick={() => {
                                const nextValue = isSettled ? "false" : "true";
                                field.handleChange(nextValue);
                                if (isBoleto) {
                                  form.setFieldValue(
                                    "boletoPaymentDate",
                                    nextValue === "true"
                                      ? form.getFieldValue("boletoPaymentDate") ||
                                          getCurrentDateInBrazil()
                                      : "",
                                  );
                                }
                              }}
                              size="icon-sm"
                              type="button"
                              variant="ghost"
                            >
                              {isSettled ? (
                                <CircleCheck aria-hidden="true" />
                              ) : (
                                <Circle aria-hidden="true" />
                              )}
                            </Button>
                          </section>
                        );
                      }}
                    </form.Field>
                  ) : null}
                </section>

                <details
                  className="group"
                  onToggle={(event) => setIsAdvancedOpen(event.currentTarget.open)}
                  open={isAdvancedOpen}
                >
                  <summary className="flex cursor-pointer list-none items-center gap-2 text-muted-foreground text-sm transition-colors hover:text-foreground">
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 transition-transform group-open:rotate-180"
                    />
                    Condições, anotações e anexos
                    {pendingFiles.length ? (
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 font-medium text-brand-strong text-xs">
                        {pendingFiles.length} {pendingFiles.length === 1 ? "anexo" : "anexos"}
                      </span>
                    ) : null}
                  </summary>

                  <div className="mt-4 grid gap-4">
                    {!isTransfer ? (
                      <div
                        className={
                          values.condition === "single" || isSeriesEdit
                            ? "grid gap-4"
                            : "grid gap-4 sm:grid-cols-2"
                        }
                      >
                        {!isSeriesEdit && !isTransfer ? (
                          <form.Field name="condition">
                            {(field) => (
                              <FieldShell
                                error={getTransactionFormErrorMessage(
                                  "condition",
                                  field.state.meta.errors,
                                )}
                                label="Condição"
                              >
                                <Select
                                  disabled={isSubmitting || isTransfer}
                                  onValueChange={(value) => {
                                    const condition = value as TransactionFormValues["condition"];
                                    field.handleChange(condition);
                                    if (condition === "recurring" && pendingFiles.length) {
                                      setPendingFiles([]);
                                      toast.info("Os anexos selecionados foram removidos", {
                                        description:
                                          "Anexos ficam disponíveis quando a recorrência gerar um lançamento.",
                                      });
                                    }
                                  }}
                                  value={field.state.value}
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-invalid={field.state.meta.errors.length > 0}
                                  >
                                    <SelectValue placeholder="Selecione">
                                      <TransactionConditionOption condition={field.state.value} />
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(transactionConditionLabels)
                                      .filter(
                                        ([value]) =>
                                          (!transaction?.isRecurring || value === "recurring") &&
                                          (!allowedConditions ||
                                            allowedConditions.includes(
                                              value as TransactionFormValues["condition"],
                                            )),
                                      )
                                      .map(([value]) => (
                                        <SelectItem key={value} value={value}>
                                          <TransactionConditionOption
                                            condition={value as TransactionFormValues["condition"]}
                                          />
                                        </SelectItem>
                                      ))}
                                  </SelectContent>
                                </Select>
                              </FieldShell>
                            )}
                          </form.Field>
                        ) : null}

                        {values.condition === "installment" && !isSeriesEdit ? (
                          <form.Field name="installmentCount">
                            {(field) => (
                              <FieldShell
                                error={getTransactionFormErrorMessage(
                                  "installmentCount",
                                  field.state.meta.errors,
                                )}
                                label="Parcelado em"
                              >
                                <Select
                                  disabled={isSubmitting}
                                  onValueChange={(value) => {
                                    if (!value) return;
                                    field.handleChange(value);
                                    if (
                                      Number(form.getFieldValue("startInstallment")) > Number(value)
                                    ) {
                                      form.setFieldValue("startInstallment", value);
                                    }
                                  }}
                                  value={field.state.value}
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-invalid={field.state.meta.errors.length > 0}
                                  >
                                    <SelectValue placeholder="Selecione">
                                      {getInstallmentLabel(Number(field.state.value))}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Array.from({ length: 59 }, (_, index) => index + 2).map(
                                      (count) => (
                                        <SelectItem key={count} value={String(count)}>
                                          {getInstallmentLabel(count)}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </FieldShell>
                            )}
                          </form.Field>
                        ) : null}

                        {showStartInstallment ? (
                          <form.Field name="startInstallment">
                            {(field) => (
                              <div className="sm:col-span-2">
                                <FieldShell
                                  error={getTransactionFormErrorMessage(
                                    "startInstallment",
                                    field.state.meta.errors,
                                  )}
                                  label="Primeira parcela a registrar"
                                >
                                  <div className="space-y-1.5">
                                    <Select
                                      disabled={isSubmitting || !Number.isInteger(installmentCount)}
                                      onValueChange={(value) => value && field.handleChange(value)}
                                      value={field.state.value}
                                    >
                                      <SelectTrigger
                                        className="w-full"
                                        aria-invalid={field.state.meta.errors.length > 0}
                                      >
                                        <SelectValue placeholder="Selecione">
                                          {Number.isInteger(startInstallment)
                                            ? `${startInstallment}ª parcela`
                                            : "Selecione"}
                                        </SelectValue>
                                      </SelectTrigger>
                                      <SelectContent>
                                        {Array.from(
                                          {
                                            length:
                                              Number.isInteger(installmentCount) &&
                                              installmentCount > 0
                                                ? installmentCount
                                                : 0,
                                          },
                                          (_, index) => index + 1,
                                        ).map((installment) => (
                                          <SelectItem key={installment} value={String(installment)}>
                                            {installment}ª parcela
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {startInstallment > 1 ? (
                                      <p className="text-muted-foreground text-xs">
                                        {getTrackedInstallmentHelper(
                                          installmentCount,
                                          startInstallment,
                                        )}
                                      </p>
                                    ) : null}
                                  </div>
                                </FieldShell>
                              </div>
                            )}
                          </form.Field>
                        ) : null}

                        {values.condition === "recurring" ? (
                          <form.Field name="recurrenceFrequency">
                            {(field) => (
                              <FieldShell
                                error={getTransactionFormErrorMessage(
                                  "recurrenceFrequency",
                                  field.state.meta.errors,
                                )}
                                label="Frequência"
                              >
                                <Select
                                  disabled={isSubmitting}
                                  onValueChange={(value) =>
                                    field.handleChange(
                                      value as TransactionFormValues["recurrenceFrequency"],
                                    )
                                  }
                                  value={field.state.value}
                                >
                                  <SelectTrigger
                                    className="w-full"
                                    aria-invalid={field.state.meta.errors.length > 0}
                                  >
                                    <SelectValue placeholder="Selecione">
                                      {recurrenceFrequencyLabels[field.state.value]}
                                    </SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(recurrenceFrequencyLabels).map(
                                      ([value, label]) => (
                                        <SelectItem key={value} value={value}>
                                          {label}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </FieldShell>
                            )}
                          </form.Field>
                        ) : null}
                      </div>
                    ) : null}

                    <form.Field name="note">
                      {(field) => (
                        <FieldShell
                          error={getTransactionFormErrorMessage("note", field.state.meta.errors)}
                          label="Observação"
                        >
                          <Textarea
                            aria-invalid={field.state.meta.errors.length > 0}
                            disabled={isSubmitting}
                            maxLength={1000}
                            onChange={(event) => field.handleChange(event.target.value)}
                            placeholder="Adicione observações sobre o lançamento"
                            rows={1}
                            value={field.state.value}
                          />
                        </FieldShell>
                      )}
                    </form.Field>
                    {mode === "edit" ? (
                      <FieldShell label="Anexos">
                        {transaction?.recordId ? (
                          <TransactionAttachments
                            onBusyChange={onAttachmentBusyChange}
                            transactionId={transaction.recordId}
                          />
                        ) : (
                          <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs">
                            Anexos ficam disponíveis em ocorrências já registradas.
                          </p>
                        )}
                      </FieldShell>
                    ) : values.condition === "recurring" ? (
                      <FieldShell label="Anexos">
                        <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs">
                          Anexos poderão ser adicionados quando houver um lançamento registrado para
                          a recorrência.
                        </p>
                      </FieldShell>
                    ) : (
                      <FieldShell label="Anexos">
                        <AttachmentFilePicker
                          disabled={isSubmitting}
                          files={pendingFiles}
                          onAdd={(file) => setPendingFiles((current) => [...current, file])}
                          onRemove={(file) =>
                            setPendingFiles((current) => current.filter((item) => item !== file))
                          }
                        />
                        {values.condition === "installment" ? (
                          <p className="text-muted-foreground text-xs">
                            Os anexos desta compra ficam vinculados à primeira parcela.
                          </p>
                        ) : null}
                      </FieldShell>
                    )}
                  </div>
                </details>
              </div>

              <DialogFooter>
                <Button
                  disabled={isSubmitting || attachmentBusy}
                  onClick={onCancel}
                  type="button"
                  variant="outline"
                >
                  Cancelar
                </Button>
                <Button
                  disabled={
                    !canSubmit ||
                    !formIsValid ||
                    isSubmitting ||
                    attachmentBusy ||
                    (mode === "edit" && !isDirty)
                  }
                  type="submit"
                >
                  {isSubmitting ? (
                    <Loader2 aria-hidden="true" className="animate-spin" size={16} />
                  ) : (
                    <Save aria-hidden="true" size={16} />
                  )}
                  {mode === "edit"
                    ? "Atualizar"
                    : (submitLabel ??
                      `Salvar ${transactionTypeLabels[values.type].toLocaleLowerCase("pt-BR")}`)}
                </Button>
              </DialogFooter>
            </>
          );
        }}
      </form.Subscribe>
      <InstallmentActionDialog
        action="edit"
        key={`edit-${transaction?.id ?? "closed"}`}
        onConfirm={async (scope) => {
          if (!pendingInstallmentUpdate) return;
          try {
            await persistTransactionUpdate(
              pendingInstallmentUpdate.data,
              scope,
              pendingInstallmentUpdate.value,
            );
          } catch (error) {
            toast.error("Não foi possível salvar o lançamento", {
              description: getTransactionMutationErrorMessage(error),
            });
          }
        }}
        onOpenChange={(open) => {
          if (!open) setPendingInstallmentUpdate(null);
        }}
        open={Boolean(pendingInstallmentUpdate)}
        pending={updateTransaction.isPending}
        transaction={transaction}
      />
    </form>
  );
}

type FieldShellProps = {
  label: string;
  error?: string;
  children: ReactNode;
};

function FieldShell({ label, error, children }: FieldShellProps) {
  const labelId = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-invalid={error ? "true" : undefined}>
      <Label htmlFor={labelId}>{label}</Label>
      <div id={labelId}>{children}</div>
      {error ? (
        <p className="sr-only" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type AccountSelectProps = {
  accounts: AccountOutput[];
  value: string;
  disabled: boolean;
  error: boolean;
  onChange: (value: string) => void;
};

function AccountSelect({ accounts, value, disabled, error, onChange }: AccountSelectProps) {
  return (
    <Select
      disabled={disabled}
      onValueChange={(nextValue) =>
        onChange(nextValue === noneValue || nextValue === null ? "" : nextValue)
      }
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
      </SelectContent>
    </Select>
  );
}

function PaymentMethodOption({ method }: { method: TransactionInput["paymentMethod"] }) {
  const Icon =
    method === "credit_card" || method === "debit_card"
      ? CreditCard
      : method === "pix"
        ? QrCode
        : method === "cash"
          ? Banknote
          : method === "boleto"
            ? Barcode
            : method === "benefits"
              ? Ticket
              : Landmark;

  return (
    <span className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span>{paymentMethodLabels[method]}</span>
    </span>
  );
}

function TransactionConditionOption({
  condition,
}: {
  condition: TransactionFormValues["condition"];
}) {
  const Icon =
    condition === "recurring" ? RefreshCw : condition === "installment" ? CalendarClock : Check;

  return (
    <span className="flex items-center gap-2">
      <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
      <span>{transactionConditionLabels[condition]}</span>
    </span>
  );
}

function TransactionTypeOption({ type }: { type: TransactionFormValues["type"] }) {
  const Icon = transactionTypeIcons[type];

  return (
    <span className="flex items-center gap-2">
      <Icon aria-hidden="true" className={cn("size-4", transactionTypeIconStyles[type])} />
      {transactionTypeLabels[type]}
    </span>
  );
}

function CategoryOption({ category }: { category?: CategoryOutput }) {
  if (!category) return <span>Selecione</span>;
  return (
    <span className="flex items-center gap-2">
      <CategoryIcon className="size-4" name={category.icon} />
      <span>{category.name}</span>
    </span>
  );
}

function PersonOption({ person }: { person?: PersonOutput }) {
  if (!person) return <span>Selecione</span>;
  return (
    <span className="flex items-center gap-2">
      <Avatar size="sm">
        <AvatarImage src={person.avatarUrl ?? undefined} alt="" />
        <AvatarFallback>{person.name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <span>{person.name}</span>
    </span>
  );
}

function EntityOption({
  entity,
}: {
  entity?: Pick<AccountOutput, "name" | "logo"> | Pick<CardOutput, "name" | "logo">;
}) {
  if (!entity) return <span>Selecione</span>;
  return (
    <span className="flex min-w-0 items-center gap-2">
      {entity.logo ? (
        <Image
          alt=""
          className="size-5 rounded-full object-contain"
          height={20}
          layout="fixed"
          src={entity.logo}
          width={20}
        />
      ) : (
        <span className="grid size-5 place-items-center rounded-full bg-muted text-[9px]">
          {entity.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <span className="truncate">{entity.name}</span>
    </span>
  );
}
