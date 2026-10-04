import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { BadgeDollarSign, CalendarArrowDown, RotateCcw } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TransactionActionsMenuProps = {
  transaction: TransactionOutput;
  trigger: ReactElement;
  triggerLabel: ReactNode;
  leadingItems: ReactNode;
  children: ReactNode;
  align?: "start" | "end";
  className?: string;
  onAnticipate: (transaction: TransactionOutput) => void;
  onUndoAnticipation: (transaction: TransactionOutput) => void;
  onRefund: (transaction: TransactionOutput) => void;
};

export function TransactionActionsMenu({
  transaction,
  trigger,
  triggerLabel,
  leadingItems,
  children,
  align = "end",
  className = "w-48",
  onAnticipate,
  onUndoAnticipation,
  onRefund,
}: TransactionActionsMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger}>{triggerLabel}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={className}>
        {leadingItems}
        {transaction.seriesId && transaction.anticipationId ? (
          <DropdownMenuItem onClick={() => onUndoAnticipation(transaction)}>
            <RotateCcw />
            Desfazer antecipação
          </DropdownMenuItem>
        ) : null}
        {transaction.recordId &&
        transaction.seriesId &&
        !transaction.anticipationId &&
        transaction.type === "expense" &&
        transaction.origin === "regular" &&
        transaction.condition === "installment" &&
        transaction.paymentMethod === "credit_card" &&
        transaction.currentInstallment !== null &&
        transaction.installmentCount !== null &&
        transaction.currentInstallment < transaction.installmentCount ? (
          <DropdownMenuItem onClick={() => onAnticipate(transaction)}>
            <CalendarArrowDown />
            Antecipar parcelas
          </DropdownMenuItem>
        ) : null}
        {transaction.recordId &&
        transaction.type === "expense" &&
        transaction.origin === "regular" &&
        transaction.refundableAmount > 0 ? (
          <DropdownMenuItem onClick={() => onRefund(transaction)}>
            <BadgeDollarSign />
            Registrar reembolso
          </DropdownMenuItem>
        ) : null}

        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
