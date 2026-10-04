import type { TransactionImportPreview } from "@openmonetis/validators/transactions";
import { FileSpreadsheet } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import { Card, CardContent } from "@/components/ui/card";
import type { useTransactionImportReview } from "../useTransactionImportReview";
import { formatDate } from "./transaction-import-screen-options";
export function TransactionImportSummary({
  preview,
  rows,
  selectedRows,
  incompleteRows,
  duplicateCount,
}: {
  preview: TransactionImportPreview;
  rows: ReturnType<typeof useTransactionImportReview>["rows"];
  selectedRows: ReturnType<typeof useTransactionImportReview>["selectedRows"];
  incompleteRows: ReturnType<typeof useTransactionImportReview>["incompleteRows"];
  duplicateCount: ReturnType<typeof useTransactionImportReview>["duplicateCount"];
}) {
  return (
    <Card className="border" size="sm">
      <CardContent className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
            <FileSpreadsheet aria-hidden="true" className="size-5" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate font-medium">{preview.sourceName}</p>
              {preview.isCreditCard ? <Badge variant="outline">Cartão de crédito</Badge> : null}
            </div>
            <p className="mt-0.5 text-muted-foreground text-xs">
              {[
                preview.accountNumber,
                preview.period
                  ? `${formatDate(preview.period.from)} a ${formatDate(preview.period.to)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || "Extrato pronto para revisão"}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">
            {selectedRows.length} de {rows.length} selecionados
          </Badge>
          {duplicateCount ? <Badge variant="outline">{duplicateCount} já importados</Badge> : null}
          {incompleteRows.length ? (
            <Badge variant="destructive">{incompleteRows.length} sem categoria ou pessoa</Badge>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
