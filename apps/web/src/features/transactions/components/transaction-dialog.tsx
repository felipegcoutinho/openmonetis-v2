import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { MobileFormContent as DialogContent } from "@/components/forms/mobile-form-content";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getTransactionPreferenceDefaults } from "@/features/preferences/preferences.presentation";
import { userPreferencesQueryOptions } from "@/features/preferences/preferences.queries";
import { useIsMobile } from "@/hooks/useIsMobile";
import { recentEstablishmentsQueryOptions } from "../transactions.queries";
import { TransactionForm, type TransactionFormHandle } from "./transaction-form";
import type { TransactionCreateDefaults } from "./transaction-form.validation";

type TransactionDialogProps = {
  open: boolean;
  accounts: AccountOutput[];
  cards: CardOutput[];
  categories: CategoryOutput[];
  people: PersonOutput[];
  transaction: TransactionOutput | null;
  mode?: "create" | "edit" | "copy";
  defaultType?: TransactionInput["type"];
  defaultPeriod?: string;
  createDefaults?: TransactionCreateDefaults;
  createDescription?: string;
  createTitle?: string;
  allowedConditions?: readonly NonNullable<TransactionInput["condition"]>[];
  lockType?: boolean;
  showTypeSelector?: boolean;
  submitLabel?: string;
  onCreate?: (input: TransactionInput) => Promise<TransactionOutput>;
  onCreated?: (transaction: TransactionOutput) => Promise<void> | void;
  onOpenChange: (open: boolean) => void;
};

export function TransactionDialog({
  open,
  accounts,
  cards,
  categories,
  people,
  transaction,
  mode = transaction ? "edit" : "create",
  defaultType = "expense",
  defaultPeriod,
  createDefaults,
  createDescription,
  createTitle,
  allowedConditions,
  lockType = false,
  showTypeSelector = false,
  submitLabel,
  onCreate,
  onCreated,
  onOpenChange,
}: TransactionDialogProps) {
  const mobile = useIsMobile();
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const formRef = useRef<TransactionFormHandle>(null);
  const recentEstablishmentsQuery = useQuery({
    ...recentEstablishmentsQueryOptions(),
    enabled: open,
  });
  const preferencesQuery = useQuery({
    ...userPreferencesQueryOptions(),
    enabled: open && !transaction,
  });
  const effectiveCreateDefaults = {
    ...getTransactionPreferenceDefaults(preferencesQuery.data),
    ...createDefaults,
  };
  const createCopy = {
    income: {
      title: "Nova receita",
      description: "Registre o valor recebido ou previsto e onde ele será recebido.",
    },
    expense: {
      title: "Nova despesa",
      description: "Registre o valor, quem é responsável e como será pago.",
    },
    transfer: {
      title: "Nova transferência",
      description: "Informe o valor e escolha as contas de origem e destino.",
    },
  }[defaultType];

  function requestOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    if (mobile && formRef.current?.isSubmitting()) return;

    if (attachmentBusy) {
      toast.info("Aguarde a atualização dos anexos terminar.");
      return;
    }

    if (formRef.current?.hasUnsavedChanges()) {
      setDiscardOpen(true);
      return;
    }

    onOpenChange(false);
  }

  return (
    <>
      <Dialog onOpenChange={requestOpenChange} open={open}>
        <DialogContent className="flex min-w-0 flex-col overflow-hidden sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {mode === "edit"
                ? transaction?.recurringRuleId
                  ? "Editar recorrência"
                  : transaction?.isDivided
                    ? "Editar lançamento inteiro"
                    : "Editar lançamento"
                : mode === "copy"
                  ? "Copiar lançamento"
                  : (createTitle ?? createCopy.title)}
            </DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? transaction?.recurringRuleId
                  ? "Revise os dados e escolha se a alteração vale para esta ocorrência, desta em diante ou para todas."
                  : transaction?.isDivided
                    ? "A edição afeta o lançamento inteiro e suas participações."
                    : "Atualize as informações do lançamento selecionado."
                : mode === "copy"
                  ? "Revise os dados e salve para criar um novo lançamento."
                  : (createDescription ?? createCopy.description)}
            </DialogDescription>
          </DialogHeader>
          <TransactionForm
            accounts={accounts}
            attachmentBusy={attachmentBusy}
            cards={cards}
            categories={categories}
            defaultType={defaultType}
            defaultPeriod={defaultPeriod}
            createDefaults={effectiveCreateDefaults}
            establishments={recentEstablishmentsQuery.data?.items ?? []}
            establishmentsLoading={recentEstablishmentsQuery.isLoading}
            key={`${mode}-${transaction?.id ?? defaultType}-${effectiveCreateDefaults.accountId ?? ""}-${effectiveCreateDefaults.cardId ?? ""}-${effectiveCreateDefaults.categoryId ?? ""}-${effectiveCreateDefaults.paymentMethod ?? ""}`}
            allowedConditions={allowedConditions}
            lockType={lockType}
            mode={mode}
            onCreate={onCreate}
            onSaved={() => {
              onOpenChange(false);
            }}
            onCreated={onCreated}
            onAttachmentBusyChange={setAttachmentBusy}
            onCancel={() => requestOpenChange(false)}
            people={people}
            ref={formRef}
            showTypeSelector={showTypeSelector}
            submitLabel={submitLabel}
            transaction={transaction}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={setDiscardOpen} open={discardOpen}>
        <AlertDialogContent
          size="sm"
          className="w-[calc(100%-2rem)] data-[size=sm]:max-w-sm sm:data-[size=sm]:max-w-md"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As informações preenchidas neste lançamento serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="grid-cols-1 sm:grid-cols-2">
            <AlertDialogCancel className="min-w-0 whitespace-nowrap px-3">
              Continuar editando
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-w-0 whitespace-nowrap px-3"
              onClick={() => {
                setDiscardOpen(false);
                onOpenChange(false);
              }}
              variant="destructive"
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
