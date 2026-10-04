import type { RecurringExpensesReportOutput } from "@openmonetis/validators/recurring-expenses";

export type ReportItem = RecurringExpensesReportOutput["items"][number];

export type StatusFilter = ReportItem["status"] | "all";

export type PaymentFilter = ReportItem["paymentMethod"] | "all";
