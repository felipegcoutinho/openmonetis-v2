import type { TransactionInput } from "@openmonetis/validators/transactions";

import { Banknote, Barcode, CreditCard, Landmark, QrCode, Ticket } from "lucide-react";

import { paymentMethodLabels } from "../transactions.presentation";

export function PaymentMethodOption({ method }: { method: TransactionInput["paymentMethod"] }) {
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
