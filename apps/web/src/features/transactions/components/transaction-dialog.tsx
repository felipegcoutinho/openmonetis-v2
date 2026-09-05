import type { AccountOutput } from "@openmonetis/validators/accounts";
import type { CardOutput } from "@openmonetis/validators/cards";
import type { CategoryOutput } from "@openmonetis/validators/categories";
import type { PersonOutput } from "@openmonetis/validators/people";
import type { TransactionInput, TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getTransactionPreferenceDefaults } from "@/features/preferences/preferences.presentation";
import { userPreferencesQueryOptions } from "@/features/preferences/preferences.queries";
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
      description: "Informe os dados abaixo para registrar uma nova receita.",
    },
    expense: {
      title: "Nova despesa",
      description: "Informe os dados abaixo para registrar uma nova despesa.",
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
                ? "Editar lançamento"
                : mode === "copy"
                  ? "Copiar lançamento"
                  : (createTitle ?? createCopy.title)}
            </DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? "Atualize as informações do lançamento selecionado."
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
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
            <AlertDialogDescription>
              As informações preenchidas neste lançamento serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar</AlertDialogCancel>
            <AlertDialogAction
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
