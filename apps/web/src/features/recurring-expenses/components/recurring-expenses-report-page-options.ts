import {
  Banknote,
  Barcode,
  CreditCard,
  Landmark,
  type LucideIcon,
  QrCode,
  Ticket,
} from "lucide-react";

import type { ReportItem } from "./recurring-expenses-report-page.types";

export const recurringPaymentMethodIcons = {
  credit_card: CreditCard,
  debit_card: CreditCard,
  pix: QrCode,
  cash: Banknote,
  boleto: Barcode,
  benefits: Ticket,
  bank_transfer: Landmark,
} satisfies Record<ReportItem["paymentMethod"], LucideIcon>;
