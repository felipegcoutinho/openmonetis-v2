import { getCurrentDateInBrazil } from "@openmonetis/shared/date-time";
import { Circle, CircleCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { useTransactionForm } from "../useTransactionForm";
import type { TransactionFormProps } from "./transaction-form.types";
import type { TransactionFormValues } from "./transaction-form.validation";

export function TransactionSettlementField({
  form,
  transaction,
  mode,
  values,
  isSubmitting,
  isTransfer,
  isCreditCard,
  isBoleto,
}: {
  form: ReturnType<typeof useTransactionForm>["form"];
  transaction: TransactionFormProps["transaction"];
  mode: "create" | "edit" | "copy";
  values: TransactionFormValues;
  isSubmitting: boolean;
  isTransfer: boolean;
  isCreditCard: boolean;
  isBoleto: boolean;
}) {
  return (
    <>
      {!isCreditCard && !(mode === "edit" && transaction?.isRecurring) ? (
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
                    {isTransfer
                      ? "Transferência realizada"
                      : values.type === "income"
                        ? "Recebimento realizado"
                        : "Pagamento realizado"}
                  </p>
                  <p className="text-left text-muted-foreground text-xs">
                    {isTransfer
                      ? "Ative quando a movimentação já tiver sido concluída."
                      : values.type === "income"
                        ? "Ative quando o valor já tiver sido recebido."
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
                        ? values.type === "income"
                          ? "Marcar recebimento como pendente"
                          : "Marcar pagamento como pendente"
                        : values.type === "income"
                          ? "Marcar recebimento como realizado"
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
                          ? form.getFieldValue("boletoPaymentDate") || getCurrentDateInBrazil()
                          : "",
                      );
                    }
                  }}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  {isSettled ? <CircleCheck aria-hidden="true" /> : <Circle aria-hidden="true" />}
                </Button>
              </section>
            );
          }}
        </form.Field>
      ) : null}
    </>
  );
}
