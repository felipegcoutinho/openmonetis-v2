import type { TransactionOutput } from "@openmonetis/validators/transactions";
import { DueDateIndicator } from "@/features/due-date-rules/components/due-date-indicator";
import { formatCompactDate } from "../transactions.presentation";

export function TransactionDueDate({ transaction }: { transaction: TransactionOutput }) {
  if (!transaction.dueDate) return null;
  return (
    <DueDateIndicator
      dueDate={transaction.dueDate}
      originalDueDate={transaction.originalDueDate}
      adjustment={transaction.dueDateAdjustment}
      excluded={transaction.dueDateRuleExcluded}
      editable={transaction.dueDateExceptionEditable}
      target={
        transaction.recordId
          ? { target: "transaction", transactionId: transaction.recordId }
          : transaction.recurringRuleId
            ? {
                target: "recurring",
                recurringRuleId: transaction.recurringRuleId,
                occurrenceDate: transaction.purchaseDate,
              }
            : undefined
      }
    >
      Vence {formatCompactDate(transaction.dueDate)}
    </DueDateIndicator>
  );
}
