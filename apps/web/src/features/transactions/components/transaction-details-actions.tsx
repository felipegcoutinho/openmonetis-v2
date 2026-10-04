import { balanceAdjustmentCategoryName } from "@openmonetis/domain/categories";
import { canDeleteTransactionOrigin } from "@openmonetis/domain/transactions";
import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { CircleCheck, Copy, Loader2, MoreHorizontal, Pause, Trash2 } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { TransactionActionsMenu } from "./transaction-actions-menu";
import type { TransactionDetailsSheetProps } from "./transaction-details-sheet.types";
export function TransactionDetailsActions({
  detail,
  mobileActions,
  hasMobileActions,
  openRelatedAction,
  setDeleteOpen,
  setInstallmentDeleteOpen,
  setRecurringAction,
}: {
  detail: TransactionOutput;
  mobileActions: TransactionDetailsSheetProps["mobileActions"];
  hasMobileActions: string | boolean | null | undefined;
  openRelatedAction: (action: () => void) => void;
  setDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setInstallmentDeleteOpen: Dispatch<SetStateAction<boolean>>;
  setRecurringAction: Dispatch<SetStateAction<"pause" | "cancel" | null>>;
}) {
  return (
    <>
      {mobileActions && hasMobileActions ? (
        <div className="md:hidden">
          <TransactionActionsMenu
            transaction={detail}
            trigger={<Button className="w-full justify-start" type="button" variant="outline" />}
            triggerLabel={
              <>
                <MoreHorizontal aria-hidden="true" /> Ações do lançamento
              </>
            }
            leadingItems={
              detail.isSettled !== null &&
              detail.paymentMethod !== "credit_card" &&
              detail.origin === "regular" ? (
                <DropdownMenuItem
                  disabled={
                    mobileActions.pendingSettlementKey ===
                    (detail.recordId ??
                      (detail.recurringRuleId
                        ? `${detail.recurringRuleId}:${detail.purchaseDate}`
                        : null))
                  }
                  onClick={() => {
                    if (detail.recordId) {
                      mobileActions.onSettle([detail.recordId], !detail.isSettled);
                    } else if (detail.recurringRuleId) {
                      mobileActions.onSettleRecurringOccurrence(
                        detail.recurringRuleId,
                        detail.purchaseDate,
                        !detail.isSettled,
                      );
                    }
                  }}
                >
                  {mobileActions.pendingSettlementKey === detail.recordId ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <CircleCheck />
                  )}
                  {detail.isSettled ? "Marcar em aberto" : "Marcar como pago"}
                </DropdownMenuItem>
              ) : null
            }
            align="start"
            className="w-[min(18rem,calc(100vw-2rem))]"
            onUndoAnticipation={(transaction) =>
              openRelatedAction(() => mobileActions.onUndoAnticipation(transaction))
            }
            onAnticipate={(transaction) =>
              openRelatedAction(() => mobileActions.onAnticipate(transaction))
            }
            onRefund={(transaction) => openRelatedAction(() => mobileActions.onRefund(transaction))}
          >
            {detail.recordId &&
            detail.origin === "regular" &&
            detail.paymentMethod !== null &&
            detail.categoryName !== balanceAdjustmentCategoryName ? (
              <DropdownMenuItem
                onClick={() => openRelatedAction(() => mobileActions.onCopy(detail))}
              >
                <Copy /> Copiar
              </DropdownMenuItem>
            ) : null}
            {detail.recurringRuleId ? (
              <>
                <DropdownMenuItem onClick={() => setRecurringAction("pause")}>
                  <Pause /> Pausar recorrência
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setRecurringAction("cancel")}
                  variant="destructive"
                >
                  <Trash2 /> Encerrar recorrência
                </DropdownMenuItem>
              </>
            ) : null}
            {detail.recordId &&
            (detail.origin === "invoiceAdjustment" || canDeleteTransactionOrigin(detail.origin)) ? (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    detail.seriesId && detail.condition === "installment"
                      ? setInstallmentDeleteOpen(true)
                      : setDeleteOpen(true)
                  }
                  variant="destructive"
                >
                  <Trash2 /> Remover lançamento
                </DropdownMenuItem>
              </>
            ) : null}
          </TransactionActionsMenu>
        </div>
      ) : null}
    </>
  );
}
