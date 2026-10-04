import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { useQuery } from "@tanstack/react-query";
import { Pencil, X } from "lucide-react";
import { useState } from "react";
import { MobileSheetContent as SheetContent } from "@/components/forms/mobile-sheet-content";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { EstablishmentLogo } from "@/features/establishments/components/establishment-logo";
import { cn } from "@/lib/utils";
import { formatDate } from "../transactions.presentation";
import { transactionDetailQueryOptions } from "../transactions.queries";
import { TransactionDetailsActionDialogs } from "./transaction-details-action-dialogs";
import { TransactionDetailsContent } from "./transaction-details-content";

import type { TransactionDetailsSheetProps } from "./transaction-details-sheet.types";

import { TransactionDetailsSkeleton } from "./transaction-details-skeleton";

export function TransactionDetailsSheet({
  onEdit,
  onOpenChange,
  open,
  transaction,
  mobileActions,
}: TransactionDetailsSheetProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [installmentDeleteOpen, setInstallmentDeleteOpen] = useState(false);
  const [recurringAction, setRecurringAction] = useState<"pause" | "cancel" | null>(null);
  const recordId = transaction?.recordId ?? "";
  const detailQuery = useQuery({
    ...transactionDetailQueryOptions(recordId),
    enabled: open && Boolean(recordId),
  });
  const detail = detailQuery.data ?? transaction;
  const canEdit = detail?.origin === "regular" && detail.paymentMethod !== null;
  const hasMobileActions =
    detail &&
    (detail.origin === "regular" ||
      detail.recurringRuleId ||
      detail.anticipationId ||
      detail.origin === "invoiceAdjustment");

  function edit(transactionToEdit: TransactionOutput) {
    onOpenChange(false);
    onEdit(transactionToEdit);
  }

  function openRelatedAction(action: () => void) {
    onOpenChange(false);
    action();
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent
        mobileLayout="page"
        className="gap-0 data-[side=right]:w-full! sm:data-[side=right]:w-3/4! md:max-w-xl!"
        showCloseButton={false}
      >
        <Button
          data-mobile-back
          aria-label="Fechar detalhes"
          className="absolute top-3 right-3 z-10 max-sm:size-11"
          onClick={() => onOpenChange(false)}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <X aria-hidden="true" />
        </Button>
        <SheetHeader className="shrink-0 px-14 pt-8 pb-0 sm:border-b sm:p-4 sm:pr-14">
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <EstablishmentLogo name={detail?.name ?? "Lançamento"} />
            <div className="min-w-0 w-full text-center sm:flex-1 sm:text-left">
              <SheetTitle className="break-words text-base">
                {detail?.name ?? "Detalhes do lançamento"}
              </SheetTitle>
              <SheetDescription className="sr-only sm:not-sr-only">
                {detail ? formatDate(detail.purchaseDate) : "Carregando lançamento…"}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          {!detail ? (
            <TransactionDetailsSkeleton />
          ) : (
            <TransactionDetailsContent
              detail={detail}
              detailQuery={detailQuery}
              mobileActions={mobileActions}
              hasMobileActions={hasMobileActions}
              openRelatedAction={openRelatedAction}
              setDeleteOpen={setDeleteOpen}
              setInstallmentDeleteOpen={setInstallmentDeleteOpen}
              setRecurringAction={setRecurringAction}
            />
          )}
        </div>

        <SheetFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between">
          <div
            className={cn(
              "grid w-full gap-2 sm:ml-auto sm:flex sm:w-auto",
              canEdit ? "grid-cols-2" : "grid-cols-1",
            )}
          >
            <Button
              className="w-full sm:w-auto"
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Fechar
            </Button>
            {canEdit ? (
              <Button className="w-full sm:w-auto" onClick={() => edit(detail)} type="button">
                <Pencil aria-hidden="true" />
                Editar lançamento
              </Button>
            ) : null}
          </div>
        </SheetFooter>
        <TransactionDetailsActionDialogs
          detail={detail}
          mobileActions={mobileActions}
          onOpenChange={onOpenChange}
          deleteOpen={deleteOpen}
          installmentDeleteOpen={installmentDeleteOpen}
          recurringAction={recurringAction}
          setDeleteOpen={setDeleteOpen}
          setInstallmentDeleteOpen={setInstallmentDeleteOpen}
          setRecurringAction={setRecurringAction}
        />
      </SheetContent>
    </Sheet>
  );
}
